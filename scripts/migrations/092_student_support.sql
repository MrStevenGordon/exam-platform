-- 092: support for students who need it (Smart Learning).
--
-- WHAT: a staff "Support" page that lists the students who may need help (results below the school average or falling, absences,
-- lessons left unfinished, long gaps since they signed in, asking for help in class feedback), and an intervention tracker: a support
-- plan per student with a goal, a review date, the actions taken, and whether results moved afterwards.
--
-- WHO SEES WHAT
--   * A TEACHER sees the students in the classes they teach (class groups or timetable sections).
--   * A HEAD OF DEPARTMENT sees those students plus the students taught by anyone in their department.
--   * The PRINCIPAL, vice principals and SCHOOL ADMIN see every student.
--   * A STUDENT never sees any of this: not the list, not the plans, and never the school average or any classmate's figures.
--     (The student's own "My progress" page compares them only with their own earlier results and uses no database function from here.)
--   * Class feedback signals ("asked for help") are included only for feedback addressed to that teacher (or, for a head of department,
--     to teachers in their department), exactly as migration 091 shows it. The principal team and school admin get none.
--
-- The school average is only ever an average of at least 5 students. Nothing is written by the list; plans are written only by the
-- functions below, which check the caller can see the student.
--
-- Needs migration 091 (class feedback) and the timetable tables. Adds tables and functions only.
-- Roll back with scripts/migrations/rollback/092_student_support_rollback.sql

begin;

do $$
begin
  if to_regclass('public.weekly_class_feedback') is null then raise exception 'Apply migration 091 (class feedback) first.'; end if;
  if to_regclass('public.timetable_sections') is null then raise exception 'Apply the timetable migrations (060s and 088) first.'; end if;
end $$;

create or replace function public.support_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.support_ready() to authenticated;

-- Can the caller see this student in the support list? (teacher of the student; head of department of anyone teaching them; principal; school admin)
create or replace function public.support_in_scope(p_student uuid)
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_role text := public.my_role();
  v_dept uuid;
begin
  if auth.uid() is null or v_role is null or v_role not in ('teacher', 'supervisor', 'principal', 'admin') then return false; end if;
  if not exists (select 1 from profiles s where s.id = p_student and s.role = 'student' and s.is_active) then return false; end if;
  if v_role in ('principal', 'admin') then return true; end if;
  if public.is_teacher_of_class_student(p_student) or public.is_teacher_of_timetable_student(p_student) then return true; end if;
  if v_role = 'supervisor' then
    v_dept := public.my_supervised_department();
    if v_dept is null then return false; end if;
    return exists (select 1 from enrollments e join teacher_class_groups tcg on tcg.class_group_id = e.class_group_id
                     join profiles t on t.id = tcg.teacher_id where e.student_id = p_student and t.department_id = v_dept)
        or exists (select 1 from section_enrollments se join timetable_sections s on s.id = se.section_id
                     join profiles t on t.id = s.teacher_id where se.student_id = p_student and t.department_id = v_dept);
  end if;
  return false;
end $$;
revoke all on function public.support_in_scope(uuid) from public, anon;
grant execute on function public.support_in_scope(uuid) to authenticated;

-- ---------- support plans ----------
create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject text check (subject is null or length(btrim(subject)) between 1 and 100),   -- null = general support
  reason text not null check (length(btrim(reason)) between 1 and 500),
  goal text not null check (length(btrim(goal)) between 1 and 500),
  owner_id uuid not null references public.profiles(id),
  status text not null default 'open' check (status in ('open', 'monitoring', 'closed')),
  review_on date,
  baseline_pct numeric(5,1),            -- the student's average in that subject (or overall) over the 60 days before the plan started
  baseline_school_pct numeric(5,1),     -- the school average at that time (only when at least 5 students sat that subject)
  opened_by uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  outcome text check (outcome is null or outcome in ('improved', 'no_change', 'referred', 'moved', 'other')),
  outcome_note text check (outcome_note is null or length(outcome_note) <= 500),
  check ((status = 'closed') = (closed_at is not null))
);
create unique index support_cases_one_open on public.support_cases (student_id, coalesce(lower(btrim(subject)), ''))
  where status <> 'closed';
create index support_cases_student on public.support_cases (student_id);
create index support_cases_owner on public.support_cases (owner_id, status);

create table public.support_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  kind text not null check (kind in ('extra_practice', 'one_to_one', 'small_group', 'peer_tutor', 'parent_contact', 'counsellor', 'attendance_follow_up', 'other')),
  note text check (note is null or length(note) <= 500),
  done_on date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index support_actions_case on public.support_actions (case_id, done_on desc);

alter table public.support_cases enable row level security;
alter table public.support_actions enable row level security;
revoke all on public.support_cases, public.support_actions from anon, public;
grant select on public.support_cases, public.support_actions to authenticated;
create policy "Staff read plans for students they can see" on public.support_cases for select using (public.support_in_scope(student_id));
create policy "Staff read actions on plans they can see" on public.support_actions for select
  using (exists (select 1 from public.support_cases c where c.id = case_id and public.support_in_scope(c.student_id)));
-- no insert, update or delete policies: plans are written only by the functions below

-- ---------- the list ----------
-- One document: the school and subject averages, and for each student the caller can see, the figures the screen turns into reasons.
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
  v_out jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_role is null or v_role not in ('teacher', 'supervisor', 'principal', 'admin') then raise exception 'Not allowed.' using errcode = '42501'; end if;
  v_from := v_today - v_days;
  v_prev := v_today - 2 * v_days;

  with res as (
    select s.student_id, coalesce(nullif(btrim(fe.subject), ''), nullif(btrim(de.subject), ''), 'Other') as subject,
           100.0 * s.total_score / s.max_possible_score as pct, s.completed_at::date as d
    from exam_sessions s
    left join final_exams fe on fe.id = s.final_exam_id
    left join draft_exams de on de.id = s.draft_exam_id
    where s.status = 'completed' and s.fully_graded and s.max_possible_score > 0 and s.total_score is not null and s.completed_at::date > v_prev
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

-- ---------- plans: write ----------
create or replace function public.support_staff_ok(p_user uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from profiles where id = p_user and role in ('teacher', 'supervisor', 'principal', 'admin') and is_active)
$$;
revoke all on function public.support_staff_ok(uuid) from public, anon, authenticated;

create or replace function public.support_can_edit_case(p_case uuid)
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare c support_cases; v_role text := public.my_role();
begin
  if auth.uid() is null then return false; end if;
  select * into c from support_cases where id = p_case;
  if not found then return false; end if;
  if v_role in ('principal', 'admin') or c.owner_id = auth.uid() or c.opened_by = auth.uid() then return true; end if;
  return v_role = 'supervisor' and public.support_in_scope(c.student_id);
end $$;
revoke all on function public.support_can_edit_case(uuid) from public, anon;
grant execute on function public.support_can_edit_case(uuid) to authenticated;

-- The student's average (and the school's) in a subject, or overall, over the 60 days up to now: the starting line for a plan.
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

create or replace function public.support_case_update(p_case uuid, p_status text, p_review_on date, p_goal text, p_owner uuid default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare c support_cases;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  select * into c from support_cases where id = p_case;
  if not found or not public.support_can_edit_case(p_case) then raise exception 'You cannot change this plan.' using errcode = '42501'; end if;
  if c.status = 'closed' then raise exception 'This plan is closed.' using errcode = 'P0001'; end if;
  if p_status not in ('open', 'monitoring') then raise exception 'Choose open or monitoring. To finish a plan, close it with an outcome.' using errcode = 'P0001'; end if;
  if nullif(btrim(coalesce(p_goal, '')), '') is null or length(btrim(p_goal)) > 500 then raise exception 'Write a goal under 500 characters.' using errcode = 'P0001'; end if;
  if p_review_on is not null and p_review_on < public.school_today() and p_review_on is distinct from c.review_on then raise exception 'Choose a review date that is today or later.' using errcode = 'P0001'; end if;
  if p_owner is not null and p_owner <> c.owner_id and not public.support_staff_ok(p_owner) then raise exception 'That person cannot own a plan.' using errcode = 'P0001'; end if;
  update support_cases set status = p_status, review_on = p_review_on, goal = btrim(p_goal), owner_id = coalesce(p_owner, owner_id) where id = p_case;
end $$;
revoke all on function public.support_case_update(uuid, text, date, text, uuid) from public, anon;
grant execute on function public.support_case_update(uuid, text, date, text, uuid) to authenticated;

create or replace function public.support_case_close(p_case uuid, p_outcome text, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare c support_cases;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  select * into c from support_cases where id = p_case;
  if not found or not public.support_can_edit_case(p_case) then raise exception 'You cannot change this plan.' using errcode = '42501'; end if;
  if c.status = 'closed' then raise exception 'This plan is already closed.' using errcode = 'P0001'; end if;
  if p_outcome is null or p_outcome not in ('improved', 'no_change', 'referred', 'moved', 'other') then raise exception 'Choose how the plan ended.' using errcode = 'P0001'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'Please keep the note under 500 characters.' using errcode = 'P0001'; end if;
  update support_cases set status = 'closed', closed_at = now(), outcome = p_outcome, outcome_note = nullif(btrim(coalesce(p_note, '')), '') where id = p_case;
end $$;
revoke all on function public.support_case_close(uuid, text, text) from public, anon;
grant execute on function public.support_case_close(uuid, text, text) to authenticated;

create or replace function public.support_action_add(p_case uuid, p_kind text, p_note text default null, p_done_on date default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare c support_cases; v_day date := coalesce(p_done_on, public.school_today());
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  select * into c from support_cases where id = p_case;
  if not found or not public.support_in_scope(c.student_id) then raise exception 'You cannot add to this plan.' using errcode = '42501'; end if;
  if c.status = 'closed' then raise exception 'This plan is closed.' using errcode = 'P0001'; end if;
  if p_kind is null or p_kind not in ('extra_practice', 'one_to_one', 'small_group', 'peer_tutor', 'parent_contact', 'counsellor', 'attendance_follow_up', 'other') then raise exception 'Choose what was done.' using errcode = 'P0001'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'Please keep the note under 500 characters.' using errcode = 'P0001'; end if;
  if v_day > public.school_today() then raise exception 'That date has not happened yet.' using errcode = 'P0001'; end if;
  insert into support_actions (case_id, kind, note, done_on, created_by) values (p_case, p_kind, nullif(btrim(coalesce(p_note, '')), ''), v_day, auth.uid());
end $$;
revoke all on function public.support_action_add(uuid, text, text, date) from public, anon;
grant execute on function public.support_action_add(uuid, text, text, date) to authenticated;

-- ---------- plans: read (the tracker) ----------
-- Plans the caller can see, with the student's name, the actions so far, and how results moved since the plan began.
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
      'baseline_pct', c.baseline_pct, 'baseline_school_pct', c.baseline_school_pct,
      'since_pct', (select a.student_pct from public.support_average(c.student_id, c.subject, c.opened_at) a),
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

select 'Migration 092 applied' as result;
