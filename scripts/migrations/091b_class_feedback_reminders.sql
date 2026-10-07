-- 091b: the Friday reminder pieces of migration 091, for a school that applied 091 BEFORE the reminder email was added.
-- Safe to run more than once. Do not run it if you have not applied 091 at all (apply 091 instead, it already contains this).
begin;

-- ---------- Friday reminder email (used only by the server, never by a signed-in person) ----------
-- A teacher is reminded once a week, and only when at least one of their classes has no reflection yet.
create table if not exists public.weekly_feedback_reminder_log (
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

select 'Migration 091b applied' as result;
