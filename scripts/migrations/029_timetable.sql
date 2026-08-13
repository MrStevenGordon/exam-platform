-- Timetable: school-configurable periods, sections (subject + teacher +
-- day/period, optionally tied to a whole class_group), and section rosters.
-- Additive, no existing tables touched.
--
-- Grades 7-9 are typically fixed cohorts: class_group_id is set on the
-- section, and the whole class_group's enrollments are auto-copied into
-- section_enrollments at creation time (app-layer, not this migration).
-- Grades 10-11 are subject-based: class_group_id is left null and the
-- roster in section_enrollments is built by hand, one student at a time.
-- Either way, "what am I in" is always just a read of section_enrollments --
-- no branching logic at read time.

create table public.timetable_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  order_index int not null,
  academic_year text not null,
  created_at timestamp with time zone default now() not null
);

create table public.timetable_sections (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  subject text not null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_group_id uuid references public.class_groups(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 5),
  period_id uuid not null references public.timetable_periods(id) on delete cascade,
  room text,
  academic_year text not null,
  created_at timestamp with time zone default now() not null,
  -- Cheap sanity checks, not a scheduling solver: just blocks the obvious
  -- data-entry mistake of double-booking the same teacher, or the same
  -- fixed cohort, into two places in the same slot.
  unique (teacher_id, day_of_week, period_id, academic_year)
);

create unique index timetable_sections_class_group_slot on public.timetable_sections (class_group_id, day_of_week, period_id, academic_year) where class_group_id is not null;

create table public.section_enrollments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.timetable_sections(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now() not null,
  unique (section_id, student_id)
);

alter table public.timetable_periods enable row level security;
alter table public.timetable_sections enable row level security;
alter table public.section_enrollments enable row level security;

-- Same SECURITY DEFINER predicate-function pattern as my_class_group_ids()/
-- is_enrolled_in() (see enrollments' RLS) -- internal queries inside a
-- SECURITY DEFINER function bypass RLS entirely, which is what actually
-- prevents the recursive-policy trap (029 depends on 028's fix existing
-- as prior art, not as a runtime dependency).
create or replace function public.is_teacher_of_section(check_section_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from timetable_sections
    where id = check_section_id and teacher_id = auth.uid()
  );
$$;

create or replace function public.is_student_in_section(check_section_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from section_enrollments
    where section_id = check_section_id and student_id = auth.uid()
  );
$$;

create or replace function public.my_section_ids()
returns setof uuid
language sql
security definer
set search_path to 'public'
as $$
  select section_id from section_enrollments where student_id = auth.uid();
$$;

-- timetable_periods: just time definitions, non-sensitive -- any
-- authenticated staff/student can read; only admins manage.
create policy "Admins manage all timetable periods" on public.timetable_periods
  for all using (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true))
  with check (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true));

create policy "Authenticated users view timetable periods" on public.timetable_periods
  for select to authenticated using (true);

-- timetable_sections
create policy "Admins manage all timetable sections" on public.timetable_sections
  for all using (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true))
  with check (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true));

create policy "HOD manages their department timetable sections" on public.timetable_sections
  for all using (department_id = my_supervised_department() or is_admin())
  with check (department_id = my_supervised_department() or is_admin());

create policy "Teachers view their own timetable sections" on public.timetable_sections
  for select using (teacher_id = auth.uid());

create policy "Students view their enrolled timetable sections" on public.timetable_sections
  for select using (id in (select my_section_ids()));

-- section_enrollments
create policy "Admins manage all section enrollments" on public.section_enrollments
  for all using (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true))
  with check (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true));

create policy "HOD manages their department section enrollments" on public.section_enrollments
  for all using (
    exists (select 1 from timetable_sections s where s.id = section_id and (s.department_id = my_supervised_department() or is_admin()))
  )
  with check (
    exists (select 1 from timetable_sections s where s.id = section_id and (s.department_id = my_supervised_department() or is_admin()))
  );

create policy "Teachers view enrollments for their sections" on public.section_enrollments
  for select using (is_teacher_of_section(section_id));

create policy "Students view own section enrollments" on public.section_enrollments
  for select using (student_id = auth.uid());
