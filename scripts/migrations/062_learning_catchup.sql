-- Smart Learning catch-up: helping students who were absent when a lesson was taught.
--
-- HOW IT WORKS
--   * A teacher can record the day a lesson was taught to each class (learning_assignments.taught_on).
--   * A student counts as having MISSED it if attendance shows them absent that day from the
--     teacher's class in that subject (period roll call), or absent from school (morning register).
--     "Late" and "present" never count. Only rows marked absent do.
--   * The teacher can also ADD a student by hand (for example a student who was sick but the
--     register was not taken) or REMOVE one from the list (for example they got the notes from
--     a friend). Manual choices always win over the register.
--   * A student stops needing catch-up as soon as they finish the lesson.
--
-- ISOLATION
--   Smart Learning only READS attendance, through one internal function, and only when the
--   attendance tables exist (migration 055). If they do not, nobody is detected automatically
--   and everything else, including manual add/remove, keeps working. Nothing here writes to
--   attendance or to anything in Smart Assess.
--
-- PRIVACY
--   A teacher sees the catch-up list for their own lessons, for students in the classes they
--   gave it to. A student sees only whether THEY need to catch up, and on which day they were
--   away, never a reason and never anyone else.
--
-- Requires 059. (055 is optional: it adds automatic detection.)
-- Roll back with scripts/migrations/rollback/062_learning_catchup_rollback.sql

begin;

alter table public.learning_assignments
  add column if not exists taught_on date
  check (taught_on is null or taught_on between date '2020-01-01' and date '2100-01-01');

create table public.learning_catchup_overrides (
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('add', 'remove')),
  set_by uuid references public.profiles(id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);

alter table public.learning_catchup_overrides enable row level security;
create policy "Owners view their catch-up choices" on public.learning_catchup_overrides
  for select using (public.learning_owns_lesson(lesson_id) or public.is_admin());
-- No one writes directly: learning_catchup_set() below is the only way in.
revoke insert, update, delete, truncate on public.learning_catchup_overrides from anon, authenticated;

-- ---- reading attendance, if it is there ------------------------------------------------------

-- 'period' if the student was marked absent from this teacher's class in this subject on that
-- day, 'school_day' if absent at the morning register, otherwise null. The attendance tables
-- are only touched if they exist, so this is safe on a database without migration 055.
create or replace function public.learning_absent_reason(p_student uuid, p_date date, p_teacher uuid, p_subject text)
returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  r text;
begin
  if p_date is null then return null; end if;

  if to_regclass('public.class_attendance') is not null and to_regclass('public.timetable_sections') is not null then
    execute 'select ''period'' from public.class_attendance ca
               join public.timetable_sections ts on ts.id = ca.section_id
              where ca.student_id = $1 and ca.class_date = $2 and ca.status = ''absent''
                and ts.teacher_id = $3 and lower(btrim(ts.subject)) = lower(btrim($4))
              limit 1'
      into r using p_student, p_date, p_teacher, p_subject;
    if r is not null then return r; end if;
  end if;

  if to_regclass('public.daily_attendance') is not null then
    execute 'select ''school_day'' from public.daily_attendance
              where student_id = $1 and att_date = $2 and status = ''absent'' limit 1'
      into r using p_student, p_date;
    if r is not null then return r; end if;
  end if;

  return null;
end;
$$;
revoke execute on function public.learning_absent_reason(uuid, date, uuid, text) from public, anon, authenticated;

-- ---- teacher: who needs to catch up ----------------------------------------------------------

-- Students in the classes the lesson was given to who missed it (by the register or by the
-- teacher's choice), including those the teacher removed (shown as dismissed) and those who
-- have already caught up (completed_at is set).
create or replace function public.learning_catchup(p_lesson_id uuid)
returns table (
  student_id uuid, student_name text, student_code text, class_group_id uuid, class_name text,
  taught_on date, reason text, dismissed boolean, steps_done int, completed_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  l learning_lessons;
begin
  if not (public.learning_owns_lesson(p_lesson_id) or public.is_admin()) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select * into l from learning_lessons where id = p_lesson_id;
  return query
  select x.student_id, x.student_name, x.student_code, x.class_group_id, x.class_name, x.taught_on,
         case when x.auto is not null then x.auto else 'added' end,
         coalesce(x.action = 'remove', false),
         coalesce(cardinality(x.steps_done), 0), x.completed_at
  from (
    select distinct on (st.id)
           st.id as student_id, st.full_name as student_name, st.student_id as student_code,
           cg.id as class_group_id, cg.name as class_name, a.taught_on,
           public.learning_absent_reason(st.id, a.taught_on, l.teacher_id, l.subject) as auto,
           o.action, p.steps_done, p.completed_at
    from learning_assignments a
    join class_groups cg on cg.id = a.class_group_id
    join enrollments e on e.class_group_id = a.class_group_id
    join profiles st on st.id = e.student_id
    left join learning_catchup_overrides o on o.lesson_id = a.lesson_id and o.student_id = st.id
    left join learning_progress p on p.lesson_id = a.lesson_id and p.student_id = st.id
    where a.lesson_id = p_lesson_id
    order by st.id, a.taught_on nulls last
  ) x
  where x.auto is not null or x.action is not null
  order by x.class_name, x.student_name;
end;
$$;

-- The teacher's manual choice. 'add' puts a student on the list, 'remove' takes one off,
-- 'clear' goes back to whatever the register says. Only students in a class the lesson was
-- given to can be chosen.
create or replace function public.learning_catchup_set(p_lesson_id uuid, p_student_id uuid, p_action text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.learning_owns_lesson(p_lesson_id) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_action not in ('add', 'remove', 'clear') then raise exception 'Unknown choice.' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from learning_assignments a join enrollments e on e.class_group_id = a.class_group_id
     where a.lesson_id = p_lesson_id and e.student_id = p_student_id
  ) then raise exception 'That student is not in a class this lesson was given to.' using errcode = 'P0001'; end if;

  if p_action = 'clear' then
    delete from learning_catchup_overrides where lesson_id = p_lesson_id and student_id = p_student_id;
  else
    insert into learning_catchup_overrides (lesson_id, student_id, action, set_by)
    values (p_lesson_id, p_student_id, p_action, auth.uid())
    on conflict (lesson_id, student_id) do update set action = excluded.action, set_by = excluded.set_by, set_at = now();
  end if;
end;
$$;

-- ---- student: which lessons do I need to catch up on ----------------------------------------------

-- Only the student's own lessons that are open, published and unfinished, and only the day they
-- were away (null when the teacher added them by hand). No reason and no other students.
create or replace function public.learning_student_catchup()
returns table (lesson_id uuid, taught_on date)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  return query
  -- The day is only given when the register says they were away; a student the teacher added by hand
  -- (who may well have been present) is never told they were absent on a particular day.
  select y.lesson_id, case when y.auto is not null then y.taught_on else null end
  from (
    select distinct on (l.id)
           l.id as lesson_id, a.taught_on,
           public.learning_absent_reason(auth.uid(), a.taught_on, l.teacher_id, l.subject) as auto,
           o.action
    from learning_assignments a
    join learning_lessons l on l.id = a.lesson_id and l.status = 'published'
    left join learning_catchup_overrides o on o.lesson_id = l.id and o.student_id = auth.uid()
    left join learning_progress p on p.lesson_id = l.id and p.student_id = auth.uid()
    where exists (select 1 from enrollments e where e.student_id = auth.uid() and e.class_group_id = a.class_group_id)
      and p.completed_at is null
      and public.learning_student_access(l.id) = 'open'
    order by l.id, a.taught_on nulls last
  ) y
  where (y.auto is not null or y.action = 'add') and coalesce(y.action, '') <> 'remove';
end;
$$;

revoke execute on function
  public.learning_catchup(uuid), public.learning_catchup_set(uuid, uuid, text), public.learning_student_catchup()
from public, anon;
grant execute on function
  public.learning_catchup(uuid), public.learning_catchup_set(uuid, uuid, text), public.learning_student_catchup()
to authenticated;

commit;
