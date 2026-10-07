-- 091: weekly class feedback (Smart Learning).
--
-- WHAT: every week a student gives a short evaluation of each subject they had that week (from the timetable), and each teacher writes a
-- short end-of-week reflection per class. The system turns the students' answers into a progress report for each class.
--
-- WHO SEES WHAT (the privacy rule, decided once and kept in the database, not only on screen):
--   * A student sees and can change only their own answers, for this week and last week.
--   * The class TEACHER sees: how well each student said they understood, who asked for help, and each student's hardest topic, WITH names, so
--     they can help. Everything else (pace, engagement, clarity, comments) reaches the teacher without names, and only once at least 5
--     students have answered, so a single student can never be picked out.
--   * A HEAD OF DEPARTMENT sees the same for their department's classes. The principal, vice principals and the school admin see the
--     anonymous figures for every class, never names.
--   * Nobody can read the answers table directly except the student for their own rows. Everyone else goes through the functions below.
--
-- Roll back with scripts/migrations/rollback/091_class_feedback_rollback.sql

begin;

-- ---------- students' weekly answers ----------
create table public.weekly_class_feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,                                                        -- the Monday of the school week
  subject text not null check (length(btrim(subject)) between 1 and 100),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_group_id uuid references public.class_groups(id) on delete set null,
  understanding smallint not null check (understanding between 1 and 4),           -- 1 not at all ... 4 very well   (named to the teacher)
  hardest_topic_id uuid references public.curriculum_topics(id) on delete set null, -- (named to the teacher)
  needs_help boolean not null default false,                                       -- (named to the teacher)
  pace smallint check (pace between 1 and 3),                                      -- 1 too slow, 2 just right, 3 too fast   (anonymous)
  engagement smallint check (engagement between 1 and 4),                          -- anonymous
  clarity smallint check (clarity between 1 and 4),                                -- the teacher explained clearly   (anonymous)
  support smallint check (support between 1 and 4),                                -- I could ask for help   (anonymous)
  helped text check (helped is null or length(helped) <= 500),                     -- anonymous
  improve text check (improve is null or length(improve) <= 500),                  -- anonymous
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (extract(isodow from week_start) = 1)
);
create unique index weekly_class_feedback_one on public.weekly_class_feedback (student_id, week_start, lower(btrim(subject)), teacher_id);
create index weekly_class_feedback_class on public.weekly_class_feedback (teacher_id, week_start);

alter table public.weekly_class_feedback enable row level security;
revoke all on public.weekly_class_feedback from anon, public;
grant select on public.weekly_class_feedback to authenticated;
create policy "Students read their own feedback" on public.weekly_class_feedback for select using (student_id = auth.uid());
-- no insert, update or delete policies: answers are written only by class_feedback_submit()

-- ---------- teachers' end-of-week reflections ----------
create table public.weekly_class_reflections (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  subject text not null check (length(btrim(subject)) between 1 and 100),
  class_group_id uuid references public.class_groups(id) on delete set null,
  pace_vs_plan text check (pace_vs_plan is null or pace_vs_plan in ('ahead', 'on_track', 'behind')),
  covered text check (covered is null or length(covered) <= 1000),
  went_well text check (went_well is null or length(went_well) <= 1000),
  difficult text check (difficult is null or length(difficult) <= 1000),
  support_needed text check (support_needed is null or length(support_needed) <= 1000),
  next_steps text check (next_steps is null or length(next_steps) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (extract(isodow from week_start) = 1)
);
create unique index weekly_class_reflections_one on public.weekly_class_reflections
  (teacher_id, week_start, lower(btrim(subject)), coalesce(class_group_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Is this teacher in the department the caller heads? (a helper so the row rules below do not trip over the profiles rules)
create or replace function public.fb_teacher_in_my_department(p_teacher uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from profiles t where t.id = p_teacher and t.department_id is not null and t.department_id = public.my_supervised_department()) $$;

alter table public.weekly_class_reflections enable row level security;
revoke all on public.weekly_class_reflections from anon, public;
grant select, insert, update, delete on public.weekly_class_reflections to authenticated;
create policy "Teachers manage their own reflections" on public.weekly_class_reflections
  for all using (teacher_id = auth.uid() and public.my_role() in ('teacher', 'supervisor'))
  with check (teacher_id = auth.uid() and public.my_role() in ('teacher', 'supervisor'));
create policy "Heads of department read their department's reflections" on public.weekly_class_reflections
  for select using (public.is_supervisor() and public.fb_teacher_in_my_department(teacher_id));
create policy "Principals and the school admin read all reflections" on public.weekly_class_reflections
  for select using (public.is_principal() or public.is_admin());

-- A reflection is for this week or last week, and for a class the teacher really has that year.
create or replace function public.trg_weekly_class_reflections_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_this date := date_trunc('week', public.school_today())::date;
begin
  if tg_op = 'UPDATE' and (new.teacher_id <> old.teacher_id or new.week_start <> old.week_start or lower(btrim(new.subject)) <> lower(btrim(old.subject))
      or new.class_group_id is distinct from old.class_group_id) then
    raise exception 'A reflection cannot be moved to another class or week.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if new.week_start > v_this or new.week_start < v_this - 7 then
      raise exception 'You can write a reflection for this week or last week.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from timetable_sections s where s.teacher_id = new.teacher_id and lower(btrim(s.subject)) = lower(btrim(new.subject))
                   and s.class_group_id is not distinct from new.class_group_id and s.academic_year = public.school_year_for(new.week_start)) then
      raise exception 'That is not one of your classes on the timetable.' using errcode = 'P0001';
    end if;
  elsif new.week_start < v_this - 7 then
    raise exception 'That week is closed for changes.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger weekly_class_reflections_guard before insert or update on public.weekly_class_reflections
  for each row execute function public.trg_weekly_class_reflections_guard();

-- ---------- functions ----------
create or replace function public.class_feedback_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.class_feedback_ready() to authenticated;

-- The subjects a student had this week, from the timetable, with what they have already answered.
create or replace function public.class_feedback_my_week(p_week date default null)
returns table (week_start date, subject text, teacher_id uuid, teacher_name text, class_group_id uuid, class_name text, lessons integer, submitted boolean,
               understanding smallint, hardest_topic_id uuid, needs_help boolean, pace smallint, engagement smallint, clarity smallint, support smallint,
               helped text, improve text, can_edit boolean)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_week date := date_trunc('week', coalesce(p_week, public.school_today()))::date;
  v_this date := date_trunc('week', public.school_today())::date;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  return query
  select v_week, min(s.subject), s.teacher_id, min(t.full_name), (array_agg(s.class_group_id))[1], min(cg.name), count(*)::integer,
         (f.id is not null), f.understanding, f.hardest_topic_id, coalesce(f.needs_help, false), f.pace, f.engagement, f.clarity, f.support, f.helped, f.improve,
         (v_week <= v_this and v_week >= v_this - 7)
  from section_enrollments e
  join timetable_sections s on s.id = e.section_id and s.academic_year = public.school_year_for(v_week)
  join profiles t on t.id = s.teacher_id
  left join class_groups cg on cg.id = s.class_group_id
  left join weekly_class_feedback f on f.student_id = e.student_id and f.week_start = v_week and lower(btrim(f.subject)) = lower(btrim(s.subject)) and f.teacher_id = s.teacher_id
  where e.student_id = auth.uid()
  group by lower(btrim(s.subject)), s.teacher_id, f.id, f.understanding, f.hardest_topic_id, f.needs_help, f.pace, f.engagement, f.clarity, f.support, f.helped, f.improve
  order by min(s.subject);
end $$;
revoke all on function public.class_feedback_my_week(date) from public, anon;
grant execute on function public.class_feedback_my_week(date) to authenticated;

-- Saves (or changes) a student's answers for one subject and week.
create or replace function public.class_feedback_submit(
  p_week date, p_subject text, p_teacher uuid, p_understanding integer, p_pace integer default null, p_engagement integer default null,
  p_clarity integer default null, p_support integer default null, p_hardest_topic uuid default null, p_needs_help boolean default false,
  p_helped text default null, p_improve text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_week date := date_trunc('week', p_week)::date;
  v_this date := date_trunc('week', public.school_today())::date;
  v_class uuid;
  v_helped text := nullif(btrim(coalesce(p_helped, '')), '');
  v_improve text := nullif(btrim(coalesce(p_improve, '')), '');
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if public.my_role() <> 'student' then raise exception 'Only students give this feedback.' using errcode = '42501'; end if;
  if v_week > v_this then raise exception 'That week has not started yet.' using errcode = 'P0001'; end if;
  if v_week < v_this - 7 then raise exception 'That week is closed. You can give feedback for this week or last week.' using errcode = 'P0001'; end if;
  if p_understanding is null or p_understanding not between 1 and 4 then raise exception 'Say how well you understood this week.' using errcode = 'P0001'; end if;
  if p_pace is not null and p_pace not between 1 and 3 then raise exception 'That pace answer is not available.' using errcode = 'P0001'; end if;
  if p_engagement is not null and p_engagement not between 1 and 4 then raise exception 'That answer is not available.' using errcode = 'P0001'; end if;
  if p_clarity is not null and p_clarity not between 1 and 4 then raise exception 'That answer is not available.' using errcode = 'P0001'; end if;
  if p_support is not null and p_support not between 1 and 4 then raise exception 'That answer is not available.' using errcode = 'P0001'; end if;
  if length(coalesce(v_helped, '')) > 500 or length(coalesce(v_improve, '')) > 500 then raise exception 'Please keep each comment under 500 characters.' using errcode = 'P0001'; end if;

  -- the student really has this subject with this teacher that week
  select (array_agg(s.class_group_id))[1] into v_class
  from section_enrollments e join timetable_sections s on s.id = e.section_id
  where e.student_id = auth.uid() and s.teacher_id = p_teacher and lower(btrim(s.subject)) = lower(btrim(p_subject)) and s.academic_year = public.school_year_for(v_week)
  having count(*) > 0;
  if not found then raise exception 'That class is not on your timetable.' using errcode = 'P0001'; end if;

  if p_hardest_topic is not null and not exists (select 1 from curriculum_topics where id = p_hardest_topic and status <> 'archived') then
    raise exception 'That topic was not found.' using errcode = 'P0001';
  end if;

  insert into weekly_class_feedback (student_id, week_start, subject, teacher_id, class_group_id, understanding, hardest_topic_id, needs_help, pace, engagement, clarity, support, helped, improve)
  values (auth.uid(), v_week, btrim(p_subject), p_teacher, v_class, p_understanding, p_hardest_topic, coalesce(p_needs_help, false), p_pace, p_engagement, p_clarity, p_support, v_helped, v_improve)
  on conflict (student_id, week_start, lower(btrim(subject)), teacher_id) do update set
    understanding = excluded.understanding, hardest_topic_id = excluded.hardest_topic_id, needs_help = excluded.needs_help, pace = excluded.pace,
    engagement = excluded.engagement, clarity = excluded.clarity, support = excluded.support, helped = excluded.helped, improve = excluded.improve, updated_at = now();
end $$;
revoke all on function public.class_feedback_submit(date, text, uuid, integer, integer, integer, integer, integer, uuid, boolean, text, text) from public, anon;
grant execute on function public.class_feedback_submit(date, text, uuid, integer, integer, integer, integer, integer, uuid, boolean, text, text) to authenticated;

-- The progress report: one row per class and week. A teacher gets their own classes; a head of department their department's; the principal,
-- vice principals and school admin every class. The privacy rule above is applied here, row by row.
create or replace function public.class_feedback_report(p_from date, p_to date)
returns table (week_start date, teacher_id uuid, teacher_name text, department_id uuid, subject text, class_group_id uuid, class_name text,
               enrolled integer, responded integer, hidden boolean, understanding_avg numeric, pace jsonb, engagement_avg numeric, clarity_avg numeric, support_avg numeric,
               hardest_topics jsonb, helped jsonb, improve jsonb, needs_attention jsonb, reflection jsonb, lessons_taught jsonb)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  c_min constant integer := 5;
  v_role text := public.my_role();
  v_named boolean;                 -- may this person see student names (their own class, or a head's department)?
  v_all boolean := public.is_principal() or public.is_admin();
  v_dept uuid := public.my_supervised_department();
  v_from date := date_trunc('week', p_from)::date;
  v_to date := date_trunc('week', p_to)::date;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_role not in ('teacher', 'supervisor', 'principal', 'admin') and not v_all then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if v_to < v_from or v_to - v_from > 7 * 12 then raise exception 'Choose up to twelve weeks.' using errcode = 'P0001'; end if;
  v_named := v_role in ('teacher', 'supervisor');

  return query
  with weeks as (select g::date as w from generate_series(v_from, v_to, interval '7 days') g),
  classes as (
    select s.teacher_id, min(t.full_name) as teacher_name, t.department_id, min(s.subject) as subject, s.class_group_id, min(cg.name) as class_name,
           count(distinct e.student_id)::integer as enrolled
    from timetable_sections s
    join profiles t on t.id = s.teacher_id
    left join class_groups cg on cg.id = s.class_group_id
    left join section_enrollments e on e.section_id = s.id
    where s.academic_year in (public.school_year_for(v_from), public.school_year_for(v_to))
      and (v_all or s.teacher_id = auth.uid() or (v_role = 'supervisor' and public.fb_teacher_in_my_department(s.teacher_id)))
    group by s.teacher_id, t.department_id, lower(btrim(s.subject)), s.class_group_id
  ),
  grid as (select c.*, w.w from classes c cross join weeks w),
  fb as (
    select f.*, p.full_name as student_name, ct.name as topic_name
    from weekly_class_feedback f
    join profiles p on p.id = f.student_id
    left join curriculum_topics ct on ct.id = f.hardest_topic_id
    where f.week_start between v_from and v_to
  )
  select g.w, g.teacher_id, g.teacher_name, g.department_id, g.subject, g.class_group_id, g.class_name, g.enrolled,
         count(fb.id)::integer as responded,
         (count(fb.id) > 0 and count(fb.id) < c_min and not v_named) as hidden,
         case when count(fb.id) >= c_min or (v_named and count(fb.id) > 0) then round(avg(fb.understanding)::numeric, 2) end,
         case when count(fb.id) >= c_min then jsonb_build_object('too_slow', count(*) filter (where fb.pace = 1), 'just_right', count(*) filter (where fb.pace = 2), 'too_fast', count(*) filter (where fb.pace = 3)) end,
         case when count(fb.id) >= c_min then round(avg(fb.engagement)::numeric, 2) end,
         case when count(fb.id) >= c_min then round(avg(fb.clarity)::numeric, 2) end,
         case when count(fb.id) >= c_min then round(avg(fb.support)::numeric, 2) end,
         case when count(fb.id) >= c_min or (v_named and count(fb.id) > 0) then
           (select coalesce(jsonb_agg(jsonb_build_object('topic', x.topic_name, 'count', x.n) order by x.n desc, x.topic_name), '[]'::jsonb)
            from (select fb2.topic_name, count(*) as n from fb fb2 where fb2.teacher_id = g.teacher_id and fb2.week_start = g.w and lower(btrim(fb2.subject)) = lower(btrim(g.subject))
                    and fb2.class_group_id is not distinct from g.class_group_id and fb2.topic_name is not null group by fb2.topic_name) x) end,
         case when count(fb.id) >= c_min then (select coalesce(jsonb_agg(h order by md5(h)), '[]'::jsonb) from (select distinct fb3.helped as h from fb fb3 where fb3.teacher_id = g.teacher_id and fb3.week_start = g.w and lower(btrim(fb3.subject)) = lower(btrim(g.subject)) and fb3.class_group_id is not distinct from g.class_group_id and fb3.helped is not null) q) end,
         case when count(fb.id) >= c_min then (select coalesce(jsonb_agg(h order by md5(h)), '[]'::jsonb) from (select distinct fb3.improve as h from fb fb3 where fb3.teacher_id = g.teacher_id and fb3.week_start = g.w and lower(btrim(fb3.subject)) = lower(btrim(g.subject)) and fb3.class_group_id is not distinct from g.class_group_id and fb3.improve is not null) q) end,
         case when v_named then
           (select coalesce(jsonb_agg(jsonb_build_object('student_id', fb4.student_id, 'name', fb4.student_name, 'understanding', fb4.understanding, 'needs_help', fb4.needs_help, 'topic', fb4.topic_name) order by fb4.understanding, fb4.student_name), '[]'::jsonb)
            from fb fb4 where fb4.teacher_id = g.teacher_id and fb4.week_start = g.w and lower(btrim(fb4.subject)) = lower(btrim(g.subject)) and fb4.class_group_id is not distinct from g.class_group_id
              and (fb4.understanding <= 2 or fb4.needs_help)) end,
         (select jsonb_build_object('pace_vs_plan', r.pace_vs_plan, 'covered', r.covered, 'went_well', r.went_well, 'difficult', r.difficult, 'support_needed', r.support_needed, 'next_steps', r.next_steps)
            from weekly_class_reflections r where r.teacher_id = g.teacher_id and r.week_start = g.w and lower(btrim(r.subject)) = lower(btrim(g.subject)) and r.class_group_id is not distinct from g.class_group_id),
         (select coalesce(jsonb_agg(distinct l.title), '[]'::jsonb)
            from learning_assignments a join learning_lessons l on l.id = a.lesson_id
            where l.teacher_id = g.teacher_id and a.class_group_id is not distinct from g.class_group_id and a.taught_on between g.w and g.w + 6)
  from grid g
  left join fb on fb.teacher_id = g.teacher_id and fb.week_start = g.w and lower(btrim(fb.subject)) = lower(btrim(g.subject)) and fb.class_group_id is not distinct from g.class_group_id
  group by g.w, g.teacher_id, g.teacher_name, g.department_id, g.subject, g.class_group_id, g.class_name, g.enrolled
  order by g.w desc, g.subject, g.class_name nulls last, g.teacher_name;
end $$;
revoke all on function public.class_feedback_report(date, date) from public, anon;
grant execute on function public.class_feedback_report(date, date) to authenticated;

-- A short count for the reminder cards: a student's classes and how many they have answered; a teacher's classes and reflections written.
create or replace function public.class_feedback_status(p_week date default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_week date := date_trunc('week', coalesce(p_week, public.school_today()))::date;
  v_classes integer; v_done integer;
begin
  if auth.uid() is null then return null; end if;
  if public.my_role() = 'student' then
    select count(*), count(*) filter (where submitted) into v_classes, v_done from public.class_feedback_my_week(v_week);
    return jsonb_build_object('role', 'student', 'week', v_week, 'classes', v_classes, 'done', v_done);
  elsif public.my_role() in ('teacher', 'supervisor') then
    select count(*) into v_classes from (
      select 1 from timetable_sections s where s.teacher_id = auth.uid() and s.academic_year = public.school_year_for(v_week)
      group by lower(btrim(s.subject)), s.class_group_id) x;
    select count(*) into v_done from weekly_class_reflections r where r.teacher_id = auth.uid() and r.week_start = v_week;
    return jsonb_build_object('role', 'teacher', 'week', v_week, 'classes', v_classes, 'done', v_done,
      'responses', (select count(*) from weekly_class_feedback f where f.teacher_id = auth.uid() and f.week_start = v_week));
  end if;
  return null;
end $$;
revoke all on function public.class_feedback_status(date) from public, anon;
grant execute on function public.class_feedback_status(date) to authenticated;

-- ---------- Friday reminder email (used only by the server, never by a signed-in person) ----------
-- A teacher is reminded once a week, and only when at least one of their classes has no reflection yet.
create table public.weekly_feedback_reminder_log (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  sent_at timestamptz not null default now(),
  primary key (teacher_id, week_start)
);
alter table public.weekly_feedback_reminder_log enable row level security;
revoke all on public.weekly_feedback_reminder_log from anon, authenticated, public;

create or replace function public.class_feedback_reminder_candidates(p_week date default null)
returns table (teacher_id uuid, teacher_name text, classes jsonb)
language sql stable security definer set search_path = public, pg_temp
as $$
  with wk as (select date_trunc('week', coalesce(p_week, public.school_today()))::date as w),
  cls as (
    select s.teacher_id, min(s.subject) as subject, s.class_group_id, min(cg.name) as class_name,
           count(distinct e.student_id)::integer as enrolled
    from timetable_sections s
    left join class_groups cg on cg.id = s.class_group_id
    left join section_enrollments e on e.section_id = s.id
    where s.academic_year = public.school_year_for((select w from wk))
    group by s.teacher_id, lower(btrim(s.subject)), s.class_group_id
  ),
  detail as (
    select c.teacher_id, c.subject, c.class_name, c.enrolled,
           (select count(*) from weekly_class_feedback f where f.teacher_id = c.teacher_id and f.week_start = (select w from wk)
              and lower(btrim(f.subject)) = lower(btrim(c.subject)) and f.class_group_id is not distinct from c.class_group_id)::integer as responded,
           exists (select 1 from weekly_class_reflections r where r.teacher_id = c.teacher_id and r.week_start = (select w from wk)
              and lower(btrim(r.subject)) = lower(btrim(c.subject)) and r.class_group_id is not distinct from c.class_group_id) as reflected
    from cls c
  )
  select d.teacher_id, p.full_name,
         jsonb_agg(jsonb_build_object('subject', d.subject, 'class_name', d.class_name, 'enrolled', d.enrolled, 'responded', d.responded, 'reflected', d.reflected) order by d.subject, d.class_name)
  from detail d
  join profiles p on p.id = d.teacher_id and p.is_active and p.role in ('teacher', 'supervisor')
  where not exists (select 1 from weekly_feedback_reminder_log l where l.teacher_id = d.teacher_id and l.week_start = (select w from wk))
  group by d.teacher_id, p.full_name
  having bool_or(not d.reflected);
$$;
revoke all on function public.class_feedback_reminder_candidates(date) from public, anon, authenticated;
grant execute on function public.class_feedback_reminder_candidates(date) to service_role;

commit;

select 'Migration 091 applied' as result;
