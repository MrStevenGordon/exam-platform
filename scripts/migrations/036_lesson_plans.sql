-- Lesson Plan Library (per-school half). Teachers build and AI-assist their
-- own lesson plans using the real MoEYI/NSC 5E template. Supervisors/admins
-- get unscoped read visibility, matching the existing precedent for
-- staff-created content (see 033_report_cards_supervisor_scope_fix.sql --
-- profiles.department_id is only ever set for staff, not a reliable scope
-- for anything student-facing, but lesson plans are staff-authored content
-- with no student on the row at all, so unscoped is the only sensible model
-- here regardless).
--
-- published_to_library/library_ref_id track whether this plan has been
-- published to the separate central Lesson Library project (cross-school
-- sharing) -- that project has no RLS of its own since it has no end-user
-- auth; every read/write to it happens server-side only, via
-- /api/lesson-plans/publish, /library, /copy.

create table public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  subject text not null,
  grade text not null,
  term text,
  unit_theme text,
  focus_strand text,
  topic text not null,
  focus_question text,
  duration text,
  attainment_target text,
  specific_objective text,
  skills text,
  prior_learning text,
  materials text,
  engage text,
  explore text,
  explain text,
  elaborate text,
  evaluate text,
  success_criteria text,
  published_to_library boolean not null default false,
  library_ref_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lesson_plans enable row level security;

create policy "Teachers manage their own lesson plans" on public.lesson_plans
  for all using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "Supervisors and admins view all lesson plans" on public.lesson_plans
  for select using (my_role() = 'supervisor' or is_admin());
