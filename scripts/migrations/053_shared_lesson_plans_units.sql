-- Same unit columns as 052, for the cross-school library. Like 038, this
-- targets the CENTRAL Supabase project (the one behind LIBRARY_SUPABASE_URL),
-- NOT a school's own project. Additive only. Until it is applied there, the
-- publish route falls back to publishing lesson 1 only (see
-- src/app/api/lesson-plans/library/publish/route.ts), so nothing breaks.
--
-- Roll back with scripts/migrations/rollback/053_shared_lesson_plans_units_rollback.sql

alter table public.shared_lesson_plans
  add column if not exists sub_topics text,
  add column if not exists prerequisite_knowledge text,
  add column if not exists four_cs text,
  add column if not exists subject_practices text,
  add column if not exists general_objectives text,
  add column if not exists key_terms_formulae text,
  add column if not exists lessons jsonb not null default '[]'::jsonb;
