-- Report cards: a real academic_terms table (report cards are generated
-- per term), plus two staff-entered tables that get merged with a live
-- computation over exam_sessions at view time. No "report card" row is
-- ever materialized -- every view of a report card is a fresh read.
--
-- Note: draft_exams.term (free text, added earlier, uncontrolled) is
-- unrelated to academic_terms and is NOT used by this feature. Term
-- scoping here is purely by exam_sessions.completed_at falling inside
-- [academic_terms.start_date, academic_terms.end_date].

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  academic_year text not null,
  start_date date not null,
  end_date date not null,
  report_cards_released boolean default false not null,
  created_at timestamp with time zone default now() not null,
  check (end_date >= start_date)
);

create table public.report_card_comments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  subject text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  comment text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  unique (student_id, term_id, subject)
);

create table public.report_card_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  days_present integer,
  days_absent integer,
  days_late integer,
  conduct_comment text,
  entered_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  unique (student_id, term_id)
);

alter table public.academic_terms enable row level security;
alter table public.report_card_comments enable row level security;
alter table public.report_card_attendance enable row level security;

-- academic_terms: admin (+ system admin) manage; everyone authenticated
-- can read (students/teachers/supervisors all need the term list to pick
-- which one to view/enter data for).
create policy "Admins manage academic terms" on public.academic_terms
  for all using (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true))
  with check (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true));

create policy "Authenticated users view academic terms" on public.academic_terms
  for select to authenticated using (true);

-- report_card_comments
create policy "Admins manage all report card comments" on public.report_card_comments
  for all using (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true))
  with check (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true));

create policy "Supervisors view their department report card comments" on public.report_card_comments
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = report_card_comments.student_id
      and profiles.department_id = my_supervised_department()
    )
  );

-- Trust level matches existing self-attributed write patterns (e.g. essay
-- grading): the UI only lets a teacher pick students/subjects sourced from
-- section_enrollments/timetable_sections they actually teach; RLS just
-- enforces teacher_id = auth.uid() on the row itself.
create policy "Teachers manage own report card comments" on public.report_card_comments
  for all using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "Students view own released report card comments" on public.report_card_comments
  for select using (
    student_id = auth.uid()
    and exists (
      select 1 from academic_terms
      where academic_terms.id = report_card_comments.term_id
      and academic_terms.report_cards_released = true
    )
  );

-- report_card_attendance
create policy "Admins manage all report card attendance" on public.report_card_attendance
  for all using (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true))
  with check (is_admin() or ((auth.jwt() -> 'app_metadata' ->> 'is_system_admin')::boolean = true));

create policy "Supervisors manage their department report card attendance" on public.report_card_attendance
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = report_card_attendance.student_id
      and profiles.department_id = my_supervised_department()
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = report_card_attendance.student_id
      and profiles.department_id = my_supervised_department()
    )
  );

create policy "Students view own released report card attendance" on public.report_card_attendance
  for select using (
    student_id = auth.uid()
    and exists (
      select 1 from academic_terms
      where academic_terms.id = report_card_attendance.term_id
      and academic_terms.report_cards_released = true
    )
  );
