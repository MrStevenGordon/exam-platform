-- 092b: limit support RESULTS to the subjects the person teaches (a teacher's own, a head of department's department's; everyone's for the principal team
-- and school admin). For a school that applied 092 BEFORE this change. Safe to run more than once. Do not run it if you have not applied 092 at all
-- (apply 092 instead, it already contains this).
begin;

create or replace function public.support_subject_matches(a text, b text)
returns boolean
language sql immutable
as $$
  with n as (
    select case when lower(btrim(coalesce(a, ''))) in ('maths', 'math') then 'mathematics' else lower(btrim(coalesce(a, ''))) end as x,
           case when lower(btrim(coalesce(b, ''))) in ('maths', 'math') then 'mathematics' else lower(btrim(coalesce(b, ''))) end as y
  )
  select length(x) >= 3 and length(y) >= 3 and (x = y or x like '%' || y || '%' or y like '%' || x || '%') from n
$$;
grant execute on function public.support_subject_matches(text, text) to authenticated;

create or replace function public.support_allowed_subjects()
returns setof text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_role text := public.my_role(); v_dept uuid := public.my_supervised_department(); v_year text := public.school_year_for(public.school_today());
begin
  if auth.uid() is null or v_role is null or v_role not in ('teacher', 'supervisor') then return; end if;
  return query
    select ts.subject from teacher_subjects ts where ts.teacher_id = auth.uid()
    union select s.subject from timetable_sections s where s.teacher_id = auth.uid() and s.academic_year = v_year
    union select ts.subject from teacher_subjects ts where v_role = 'supervisor' and v_dept is not null and ts.department_id = v_dept
    union select s.subject from timetable_sections s join profiles t on t.id = s.teacher_id
          where v_role = 'supervisor' and v_dept is not null and t.department_id = v_dept and s.academic_year = v_year;
end $$;
revoke all on function public.support_allowed_subjects() from public, anon;
grant execute on function public.support_allowed_subjects() to authenticated;

create or replace function public.support_subject_ok(p_subject text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select auth.uid() is not null and (
    public.my_role() in ('principal', 'admin')
    or exists (select 1 from public.support_allowed_subjects() a(subject) where public.support_subject_matches(a.subject, p_subject)))
$$;
revoke all on function public.support_subject_ok(text) from public, anon;
grant execute on function public.support_subject_ok(text) to authenticated;

create or replace function public.support_students(p_days integer default 60)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_role text := public.my_role();
  v_today date := public.school_today();
  v_days integer := least(greatest(coalesce(p_days, 60), 14), 180);
  v_from date;
  v_prev date;
  v_dept uuid := public.my_supervised_department();
  v_all boolean := v_role in ('principal', 'admin');   -- not limited to the caller's own subjects
  v_out jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_role is null or v_role not in ('teacher', 'supervisor', 'principal', 'admin') then raise exception 'Not allowed.' using errcode = '42501'; end if;
  v_from := v_today - v_days;
  v_prev := v_today - 2 * v_days;

  with allowed as (select a.subject from public.support_allowed_subjects() a(subject)),
  res as (
    -- only results in subjects the caller may see (a teacher's own, a head's department's); everything for the principal team and school admin
    select s.student_id, coalesce(nullif(btrim(fe.subject), ''), nullif(btrim(de.subject), ''), 'Other') as subject,
           100.0 * s.total_score / s.max_possible_score as pct, s.completed_at::date as d
    from exam_sessions s
    left join final_exams fe on fe.id = s.final_exam_id
    left join draft_exams de on de.id = s.draft_exam_id
    where s.status = 'completed' and s.fully_graded and s.max_possible_score > 0 and s.total_score is not null and s.completed_at::date > v_prev
      and (v_all or exists (select 1 from allowed al where public.support_subject_matches(al.subject, coalesce(nullif(btrim(fe.subject), ''), nullif(btrim(de.subject), ''), 'Other'))))
  ),
  stu_subj as (
    select student_id, subject, avg(pct) filter (where d > v_from) as avg_recent, count(*) filter (where d > v_from) as n_recent, avg(pct) filter (where d <= v_from) as avg_prev
    from res group by student_id, subject
  ),
  stu_all as (
    select student_id, avg(pct) filter (where d > v_from) as avg_recent, count(*) filter (where d > v_from) as n_recent, avg(pct) filter (where d <= v_from) as avg_prev
    from res group by student_id
  ),
  bench_subj as (select subject, round(avg(avg_recent), 1) as avg, count(*) as n from stu_subj where avg_recent is not null group by subject having count(*) >= 5),
  bench_all as (select round(avg(avg_recent), 1) as avg, count(*) as n from stu_all where avg_recent is not null having count(*) >= 5),
  sc as (
    select p.id, p.full_name, p.grade_level, p.active_login_last_seen_at as last_seen
    from profiles p where p.role = 'student' and p.is_active and public.support_in_scope(p.id)
  ),
  att as (
    select a.student_id, count(*) filter (where a.status = 'absent') as absent, count(*) filter (where a.status = 'late') as late, count(*) as marked
    from daily_attendance a where a.att_date > v_today - 14 and a.att_date <= v_today and a.student_id in (select id from sc) group by a.student_id
  ),
  due as (
    select e.student_id, a.lesson_id
    from enrollments e
    join learning_assignments a on a.class_group_id = e.class_group_id
    join learning_lessons l on l.id = a.lesson_id and l.status = 'published'
    where a.due_date < v_today and a.due_date >= v_today - 30 and e.student_id in (select id from sc)
  ),
  les as (
    select d.student_id, count(*) as due, count(*) filter (where lp.completed_at is not null) as done
    from due d left join learning_progress lp on lp.lesson_id = d.lesson_id and lp.student_id = d.student_id group by d.student_id
  ),
  fb as (
    select f.student_id, count(*) filter (where f.understanding <= 2 or f.needs_help) as low, coalesce(bool_or(f.needs_help), false) as help
    from weekly_class_feedback f
    where v_role in ('teacher', 'supervisor') and f.week_start >= date_trunc('week', v_today)::date - 7 and f.student_id in (select id from sc)
      and (f.teacher_id = auth.uid() or (v_role = 'supervisor' and exists (select 1 from profiles t where t.id = f.teacher_id and t.department_id = v_dept)))
    group by f.student_id
  )
  select jsonb_build_object(
    'scope', case when v_role in ('principal', 'admin') then 'school' when v_role = 'supervisor' then 'department' else 'classes' end,
    'days', v_days,
    'school_avg', (select avg from bench_all),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object('subject', subject, 'avg', avg, 'n', n) order by subject) from bench_subj), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sc.id, 'name', sc.full_name, 'grade', sc.grade_level,
        'classes', coalesce((select jsonb_agg(distinct cg.name) from enrollments e join class_groups cg on cg.id = e.class_group_id where e.student_id = sc.id), '[]'::jsonb),
        'overall', (select jsonb_build_object('avg', round(sa.avg_recent, 1), 'n', sa.n_recent, 'prev', round(sa.avg_prev, 1)) from stu_all sa where sa.student_id = sc.id),
        'subjects', coalesce((select jsonb_agg(jsonb_build_object('subject', ss.subject, 'avg', round(ss.avg_recent, 1), 'n', ss.n_recent, 'prev', round(ss.avg_prev, 1)) order by ss.subject)
                              from stu_subj ss where ss.student_id = sc.id and ss.avg_recent is not null), '[]'::jsonb),
        'absent', coalesce(att.absent, 0), 'late', coalesce(att.late, 0), 'marked', coalesce(att.marked, 0),
        'lessons_due', coalesce(les.due, 0), 'lessons_done', coalesce(les.done, 0),
        'last_seen', sc.last_seen,
        'help_weeks', coalesce(fb.low, 0), 'asked_help', coalesce(fb.help, false),
        'plan', (select jsonb_build_object('id', c.id, 'status', c.status, 'review_on', c.review_on, 'subject', c.subject)
                 from support_cases c where c.student_id = sc.id and c.status <> 'closed' order by c.opened_at desc limit 1)
      ) order by sc.full_name)
      from sc left join att on att.student_id = sc.id left join les on les.student_id = sc.id left join fb on fb.student_id = sc.id), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.support_students(integer) from public, anon;
grant execute on function public.support_students(integer) to authenticated;

create or replace function public.support_average(p_student uuid, p_subject text, p_since timestamptz default null)
returns table (student_pct numeric, school_pct numeric)
language sql stable security definer set search_path = public, pg_temp
as $$
  with r as (
    select s.student_id, 100.0 * s.total_score / s.max_possible_score as pct, s.completed_at,
           lower(coalesce(nullif(btrim(fe.subject), ''), nullif(btrim(de.subject), ''), 'other')) as subj
    from exam_sessions s left join final_exams fe on fe.id = s.final_exam_id left join draft_exams de on de.id = s.draft_exam_id
    where s.status = 'completed' and s.fully_graded and s.max_possible_score > 0 and s.total_score is not null
      and s.completed_at >= coalesce(p_since, now() - interval '60 days')
      and public.support_subject_ok(coalesce(nullif(btrim(fe.subject), ''), nullif(btrim(de.subject), ''), 'other'))
      and (p_subject is null or lower(coalesce(nullif(btrim(fe.subject), ''), nullif(btrim(de.subject), ''), 'other')) = lower(btrim(p_subject)))
  ), per as (select student_id, avg(pct) as a from r group by student_id)
  select (select round(avg(pct), 1) from r where student_id = p_student),
         (select case when count(*) >= 5 then round(avg(a), 1) end from per)
$$;
revoke all on function public.support_average(uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.support_case_open(p_student uuid, p_subject text, p_reason text, p_goal text, p_review_on date default null, p_owner uuid default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
  v_owner uuid := coalesce(p_owner, auth.uid());
  v_base numeric; v_school numeric; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if not public.support_in_scope(p_student) then raise exception 'You cannot make a support plan for this student.' using errcode = '42501'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Say why this student needs support.' using errcode = 'P0001'; end if;
  if nullif(btrim(coalesce(p_goal, '')), '') is null then raise exception 'Write a goal for the plan.' using errcode = 'P0001'; end if;
  if length(btrim(p_reason)) > 500 or length(btrim(p_goal)) > 500 then raise exception 'Please keep the reason and goal under 500 characters.' using errcode = 'P0001'; end if;
  if p_review_on is not null and p_review_on < public.school_today() then raise exception 'Choose a review date that is today or later.' using errcode = 'P0001'; end if;
  if not public.support_staff_ok(v_owner) then raise exception 'That person cannot own a plan.' using errcode = 'P0001'; end if;
  if v_subject is not null and not public.support_subject_ok(v_subject) then raise exception 'You can only make a plan in a subject you teach. Choose one of your subjects, or general support.' using errcode = 'P0001'; end if;
  if exists (select 1 from support_cases where student_id = p_student and status <> 'closed' and coalesce(lower(btrim(subject)), '') = coalesce(lower(v_subject), '')) then
    raise exception 'This student already has an open plan for that subject.' using errcode = 'P0001';
  end if;
  select a.student_pct, a.school_pct into v_base, v_school from public.support_average(p_student, v_subject) a;
  insert into support_cases (student_id, subject, reason, goal, owner_id, review_on, baseline_pct, baseline_school_pct, opened_by)
  values (p_student, v_subject, btrim(p_reason), btrim(p_goal), v_owner, p_review_on, v_base, v_school, auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.support_case_open(uuid, text, text, text, date, uuid) from public, anon;
grant execute on function public.support_case_open(uuid, text, text, text, date, uuid) to authenticated;

create or replace function public.support_cases_list(p_scope text default 'active')
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if public.my_role() is null or public.my_role() not in ('teacher', 'supervisor', 'principal', 'admin') then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'student_id', c.student_id, 'student', sp.full_name, 'grade', sp.grade_level,
      'classes', coalesce((select jsonb_agg(distinct cg.name) from enrollments e join class_groups cg on cg.id = e.class_group_id where e.student_id = c.student_id), '[]'::jsonb),
      'subject', c.subject, 'reason', c.reason, 'goal', c.goal, 'status', c.status, 'review_on', c.review_on,
      'owner_id', c.owner_id, 'owner', op.full_name, 'opened_by', c.opened_by, 'opened_at', c.opened_at, 'closed_at', c.closed_at, 'outcome', c.outcome, 'outcome_note', c.outcome_note,
      'progress_visible', (case when c.subject is null then (c.opened_by = auth.uid() or c.owner_id = auth.uid() or public.my_role() in ('principal', 'admin', 'supervisor')) else public.support_subject_ok(c.subject) end),
      'baseline_pct', case when (case when c.subject is null then (c.opened_by = auth.uid() or c.owner_id = auth.uid() or public.my_role() in ('principal', 'admin', 'supervisor')) else public.support_subject_ok(c.subject) end) then c.baseline_pct end,
      'baseline_school_pct', case when (case when c.subject is null then (c.opened_by = auth.uid() or c.owner_id = auth.uid() or public.my_role() in ('principal', 'admin', 'supervisor')) else public.support_subject_ok(c.subject) end) then c.baseline_school_pct end,
      'since_pct', case when (case when c.subject is null then (c.opened_by = auth.uid() or c.owner_id = auth.uid() or public.my_role() in ('principal', 'admin', 'supervisor')) else public.support_subject_ok(c.subject) end)
                        then (select a.student_pct from public.support_average(c.student_id, c.subject, c.opened_at) a) end,
      'can_edit', public.support_can_edit_case(c.id),
      'actions', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'note', a.note, 'done_on', a.done_on, 'by', ap.full_name) order by a.done_on desc, a.created_at desc)
                           from support_actions a join profiles ap on ap.id = a.created_by where a.case_id = c.id), '[]'::jsonb)
    ) order by (c.status = 'closed'), c.review_on nulls last, sp.full_name)
    from support_cases c
    join profiles sp on sp.id = c.student_id
    join profiles op on op.id = c.owner_id
    where public.support_in_scope(c.student_id)
      and ((p_scope = 'closed' and c.status = 'closed' and c.closed_at > now() - interval '180 days') or (p_scope <> 'closed' and c.status <> 'closed'))
  ), '[]'::jsonb);
end $$;
revoke all on function public.support_cases_list(text) from public, anon;
grant execute on function public.support_cases_list(text) to authenticated;

commit;

select 'Migration 092b applied' as result;
