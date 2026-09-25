-- Smart Learning, first version: lessons that teachers publish to classes, and
-- student progress through them.
--
-- SHAPE
--   learning_lessons      a student-facing lesson made from (part of) a lesson plan:
--                         five steps (Engage, Explore, Explain, Elaborate, Evaluate),
--                         each with text, optional links, and the teacher's approval.
--   learning_assignments  a published lesson given to a class group, with a due date.
--   learning_progress     which steps each student has finished.
--
-- ISOLATION
--   Smart Learning owns these three tables and touches nothing in Smart Assess. It
--   only READS the shared foundation (people, class groups, enrolments, topics).
--   Students have NO direct access to any of the tables: they use the functions at
--   the bottom, which check that the lesson is published and assigned to their class.
--   Nothing here can slow down or block exam taking.
--
-- Requires 058 (curriculum topics).
-- Roll back with scripts/migrations/rollback/059_smart_learning_rollback.sql

begin;

-- ---- the steps must have exactly this shape ------------------------------------

create or replace function public.learning_steps_valid(p_steps jsonb, p_require_ready boolean)
returns boolean
language plpgsql immutable
as $$
declare
  keys text[] := array['engage', 'explore', 'explain', 'elaborate', 'evaluate'];
  i int;
  s jsonb;
  r jsonb;
begin
  if jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps) <> 5 then return false; end if;
  for i in 0..4 loop
    s := p_steps -> i;
    if jsonb_typeof(s) is distinct from 'object' or (s ->> 'key') is distinct from keys[i + 1] then return false; end if;
    if jsonb_typeof(s -> 'text') is distinct from 'string' or length(s ->> 'text') > 8000 then return false; end if;
    if jsonb_typeof(s -> 'approved') is distinct from 'boolean' then return false; end if;
    if jsonb_typeof(s -> 'resources') is distinct from 'array' or jsonb_array_length(s -> 'resources') > 8 then return false; end if;
    for r in select jsonb_array_elements(s -> 'resources') loop
      -- Links must be web addresses (no javascript: or data: links reach a student).
      if jsonb_typeof(r) is distinct from 'object'
         or coalesce(r ->> 'url', '') !~* '^https?://[^\s]+$'
         or length(r ->> 'url') > 2000
         or length(coalesce(r ->> 'title', '')) > 200
         or coalesce(r ->> 'kind', '') not in ('video', 'link', 'file') then
        return false;
      end if;
    end loop;
    if p_require_ready and (not (s ->> 'approved')::boolean or btrim(s ->> 'text') = '') then return false; end if;
  end loop;
  return true;
end;
$$;

-- ---- tables ------------------------------------------------------------------------

create table public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  lesson_plan_id uuid references public.lesson_plans(id) on delete set null,
  plan_lesson_index int,
  title text not null check (btrim(title) <> ''),
  subject text not null check (btrim(subject) <> ''),
  grade int check (grade between 7 and 13),
  topic_id uuid references public.curriculum_topics(id) on delete set null,
  key_terms text not null default '',
  steps jsonb not null default jsonb_build_array(
    jsonb_build_object('key', 'engage', 'text', '', 'resources', '[]'::jsonb, 'approved', false),
    jsonb_build_object('key', 'explore', 'text', '', 'resources', '[]'::jsonb, 'approved', false),
    jsonb_build_object('key', 'explain', 'text', '', 'resources', '[]'::jsonb, 'approved', false),
    jsonb_build_object('key', 'elaborate', 'text', '', 'resources', '[]'::jsonb, 'approved', false),
    jsonb_build_object('key', 'evaluate', 'text', '', 'resources', '[]'::jsonb, 'approved', false)
  ),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index learning_lessons_teacher_idx on public.learning_lessons (teacher_id, updated_at desc);

create or replace function public.trg_learning_lessons_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.teacher_id <> old.teacher_id then
    raise exception 'A lesson cannot change owner.' using errcode = 'P0001';
  end if;
  if not public.learning_steps_valid(new.steps, false) then
    raise exception 'The lesson steps are not valid.' using errcode = 'P0001';
  end if;
  -- A published lesson must be complete: every step written and approved.
  if new.status = 'published' and not public.learning_steps_valid(new.steps, true) then
    raise exception 'Every step needs text and your approval before the lesson can be published.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger learning_lessons_guard before insert or update on public.learning_lessons
  for each row execute function public.trg_learning_lessons_guard();

create table public.learning_assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  class_group_id uuid not null references public.class_groups(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete cascade,
  due_date date,
  keep_open boolean not null default true,
  created_at timestamptz not null default now(),
  unique (lesson_id, class_group_id)
);
create index learning_assignments_class_idx on public.learning_assignments (class_group_id);

create or replace function public.trg_learning_assignments_guard()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from learning_lessons l where l.id = new.lesson_id and l.status = 'published') then
    raise exception 'Publish the lesson before assigning it.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger learning_assignments_guard before insert on public.learning_assignments
  for each row execute function public.trg_learning_assignments_guard();

create table public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  steps_done text[] not null default '{}',
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (lesson_id, student_id)
);

-- ---- permissions -------------------------------------------------------------------------

create or replace function public.learning_owns_lesson(p_lesson_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select exists (select 1 from learning_lessons l where l.id = p_lesson_id and l.teacher_id = auth.uid()) $$;

-- A teacher may assign only to classes they teach (a school admin to any).
create or replace function public.learning_teaches_class(p_class_group_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
      or exists (select 1 from teacher_class_groups t where t.teacher_id = auth.uid() and t.class_group_id = p_class_group_id)
$$;

alter table public.learning_lessons enable row level security;
alter table public.learning_assignments enable row level security;
alter table public.learning_progress enable row level security;

create policy "Staff manage their own lessons" on public.learning_lessons
  for all using (teacher_id = auth.uid() and public.is_staff())
  with check (teacher_id = auth.uid() and public.is_staff());
create policy "School admins view all lessons" on public.learning_lessons
  for select using (public.is_admin());

create policy "Owners manage their lesson assignments" on public.learning_assignments
  for all using (public.learning_owns_lesson(lesson_id))
  with check (public.learning_owns_lesson(lesson_id) and public.learning_teaches_class(class_group_id) and assigned_by = auth.uid());
create policy "School admins view all assignments" on public.learning_assignments
  for select using (public.is_admin());

create policy "Owners view progress on their lessons" on public.learning_progress
  for select using (public.learning_owns_lesson(lesson_id));
create policy "Students view their own progress" on public.learning_progress
  for select using (student_id = auth.uid());
-- No policy lets anyone write progress: it is recorded only by learning_mark_step().
-- Students have no policy on lessons or assignments at all: see the functions below.

-- ---- publishing --------------------------------------------------------------------------

create or replace function public.learning_publish(p_lesson_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.learning_owns_lesson(p_lesson_id) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  -- The guard trigger refuses if any step is unwritten or unapproved.
  update learning_lessons set status = 'published', published_at = coalesce(published_at, now()) where id = p_lesson_id;
end;
$$;

create or replace function public.learning_unpublish(p_lesson_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.learning_owns_lesson(p_lesson_id) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  update learning_lessons set status = 'draft' where id = p_lesson_id;
end;
$$;

-- ---- what a student can see and do ------------------------------------------------------------

-- A lesson is open to a student if it is published, given to a class they are in, and
-- (when the teacher chose to close it after the due date) not past due.
create or replace function public.learning_student_access(p_lesson_id uuid)
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when not exists (
      select 1 from learning_assignments a join learning_lessons l on l.id = a.lesson_id
      where a.lesson_id = p_lesson_id and l.status = 'published'
        and exists (select 1 from enrollments e where e.student_id = auth.uid() and e.class_group_id = a.class_group_id)
    ) then 'none'
    when exists (
      select 1 from learning_assignments a
      where a.lesson_id = p_lesson_id
        and exists (select 1 from enrollments e where e.student_id = auth.uid() and e.class_group_id = a.class_group_id)
        and (a.keep_open or a.due_date is null or a.due_date >= (now() at time zone 'America/Jamaica')::date)
    ) then 'open'
    else 'closed'
  end
$$;

create or replace function public.learning_student_lessons()
returns table (
  lesson_id uuid, title text, subject text, teacher_name text, due_date date,
  steps_done int, completed_at timestamptz, last_activity_at timestamptz, closed boolean
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  return query
  select distinct on (l.id)
         l.id, l.title, l.subject, t.full_name, a.due_date,
         coalesce(cardinality(p.steps_done), 0), p.completed_at, p.last_activity_at,
         (public.learning_student_access(l.id) = 'closed')
  from learning_assignments a
  join learning_lessons l on l.id = a.lesson_id and l.status = 'published'
  join profiles t on t.id = l.teacher_id
  left join learning_progress p on p.lesson_id = l.id and p.student_id = auth.uid()
  where exists (select 1 from enrollments e where e.student_id = auth.uid() and e.class_group_id = a.class_group_id)
  order by l.id, a.due_date nulls last;
end;
$$;

create or replace function public.learning_get_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_access text := public.learning_student_access(p_lesson_id);
  l learning_lessons;
  v_teacher text;
  v_due date;
  v_prog learning_progress;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_access = 'none' then raise exception 'This lesson is not available to you.' using errcode = '42501'; end if;
  if v_access = 'closed' then raise exception 'This lesson closed after its due date.' using errcode = 'P0001'; end if;
  select * into l from learning_lessons where id = p_lesson_id;
  select full_name into v_teacher from profiles where id = l.teacher_id;
  select min(a.due_date) into v_due from learning_assignments a
   where a.lesson_id = p_lesson_id and exists (select 1 from enrollments e where e.student_id = auth.uid() and e.class_group_id = a.class_group_id);
  select * into v_prog from learning_progress where lesson_id = p_lesson_id and student_id = auth.uid();
  return jsonb_build_object(
    'id', l.id, 'title', l.title, 'subject', l.subject, 'grade', l.grade,
    'teacher_name', v_teacher, 'due_date', v_due, 'key_terms', l.key_terms,
    -- Only what students need: text and links, never the approval flags.
    'steps', (select jsonb_agg(jsonb_build_object('key', s ->> 'key', 'text', s ->> 'text', 'resources', s -> 'resources') order by ord)
                from jsonb_array_elements(l.steps) with ordinality as x(s, ord)),
    'steps_done', to_jsonb(coalesce(v_prog.steps_done, '{}'::text[])),
    'completed_at', v_prog.completed_at
  );
end;
$$;

create or replace function public.learning_mark_step(p_lesson_id uuid, p_step text, p_done boolean default true)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_access text := public.learning_student_access(p_lesson_id);
  v_done text[];
  v_all boolean;
  v_completed timestamptz;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_access = 'none' then raise exception 'This lesson is not available to you.' using errcode = '42501'; end if;
  if v_access = 'closed' then raise exception 'This lesson closed after its due date.' using errcode = 'P0001'; end if;
  if p_step not in ('engage', 'explore', 'explain', 'elaborate', 'evaluate') then raise exception 'Unknown step.' using errcode = 'P0001'; end if;

  insert into learning_progress (lesson_id, student_id) values (p_lesson_id, auth.uid())
  on conflict (lesson_id, student_id) do nothing;

  select steps_done into v_done from learning_progress where lesson_id = p_lesson_id and student_id = auth.uid() for update;
  v_done := case when p_done then (select coalesce(array_agg(distinct x), '{}') from unnest(v_done || p_step) x)
                 else array_remove(v_done, p_step) end;
  v_all := (select count(*) from unnest(v_done) x where x in ('engage', 'explore', 'explain', 'elaborate', 'evaluate')) = 5;

  update learning_progress
     set steps_done = v_done,
         last_activity_at = now(),
         completed_at = case when v_all then coalesce(completed_at, now()) else null end
   where lesson_id = p_lesson_id and student_id = auth.uid()
  returning completed_at into v_completed;

  return jsonb_build_object('steps_done', to_jsonb(v_done), 'completed_at', v_completed);
end;
$$;

-- ---- what the teacher sees ------------------------------------------------------------------------

-- Every student in every class the lesson is assigned to, finished or not.
create or replace function public.learning_results(p_lesson_id uuid)
returns table (
  student_id uuid, student_name text, student_code text, class_group_id uuid, class_name text,
  due_date date, steps_done int, started_at timestamptz, last_activity_at timestamptz, completed_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not (public.learning_owns_lesson(p_lesson_id) or public.is_admin()) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select st.id, st.full_name, st.student_id, cg.id, cg.name, a.due_date,
         coalesce(cardinality(p.steps_done), 0), p.started_at, p.last_activity_at, p.completed_at
  from learning_assignments a
  join class_groups cg on cg.id = a.class_group_id
  join enrollments e on e.class_group_id = a.class_group_id
  join profiles st on st.id = e.student_id
  left join learning_progress p on p.lesson_id = a.lesson_id and p.student_id = st.id
  where a.lesson_id = p_lesson_id
  order by cg.name, st.full_name;
end;
$$;

-- For the teacher's lesson list: how many students, how many started, how many finished.
create or replace function public.learning_lesson_stats()
returns table (lesson_id uuid, assigned_students int, started int, completed int)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.is_staff() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select l.id,
         (select count(distinct e.student_id)::int from learning_assignments a join enrollments e on e.class_group_id = a.class_group_id where a.lesson_id = l.id),
         (select count(*)::int from learning_progress p where p.lesson_id = l.id and cardinality(p.steps_done) > 0),
         (select count(*)::int from learning_progress p where p.lesson_id = l.id and p.completed_at is not null)
  from learning_lessons l
  where l.teacher_id = auth.uid();
end;
$$;

revoke execute on function
  public.learning_publish(uuid), public.learning_unpublish(uuid), public.learning_student_access(uuid),
  public.learning_student_lessons(), public.learning_get_lesson(uuid), public.learning_mark_step(uuid, text, boolean),
  public.learning_results(uuid), public.learning_lesson_stats()
from public, anon;
grant execute on function
  public.learning_publish(uuid), public.learning_unpublish(uuid),
  public.learning_student_lessons(), public.learning_get_lesson(uuid), public.learning_mark_step(uuid, text, boolean),
  public.learning_results(uuid), public.learning_lesson_stats()
to authenticated;

commit;
