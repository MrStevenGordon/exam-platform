-- Cross-school Lesson Plan Library. Unlike every other numbered migration
-- here, this one targets the CENTRAL/marketing Supabase project (the same
-- one that holds waitlist_signups, investor_inquiries, school_requests, and
-- ocbn_demo_leaderboard) -- NOT a per-school project. This is a deliberate
-- workaround for not having a dedicated central-library Supabase project
-- yet: since each school is already fully isolated in its own project, the
-- one project every deployment already has some relationship to is this
-- central one, so the shared library lives here instead of waiting.
--
-- No public RLS policies are added on purpose. Every read/write goes
-- through a server-side route (using the service role key) that first
-- verifies the caller against THAT SCHOOL's own Supabase auth -- there's no
-- valid end-user session against this project to write an RLS policy for,
-- so access control is enforced entirely at the API layer, not the DB layer.

create table public.shared_lesson_plans (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  teacher_name text,
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
  published_at timestamp with time zone default now() not null
);

create index shared_lesson_plans_browse_idx
  on public.shared_lesson_plans (subject, grade, published_at desc);

alter table public.shared_lesson_plans enable row level security;
