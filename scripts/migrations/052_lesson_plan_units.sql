-- Lesson plans become units: an overview plus one or more lessons.
--
-- Additive only. Every existing column and row is untouched; plans written
-- before this keep their single set of 5E fields and are shown as a one-lesson
-- unit. New plans store the per-lesson content in `lessons` (a JSON array of
-- { title, learning_objectives, engage, explore, explain, elaborate, evaluate,
-- four_cs, resources, assessment }) and mirror lesson 1's 5E fields onto the
-- old columns so older code paths keep working.
--
-- Row-level security is unchanged (same policies, new columns inherit them).
-- Roll back with scripts/migrations/rollback/052_lesson_plan_units_rollback.sql

alter table public.lesson_plans
  add column if not exists sub_topics text,
  add column if not exists prerequisite_knowledge text,
  add column if not exists four_cs text,
  add column if not exists subject_practices text,
  add column if not exists general_objectives text,
  add column if not exists key_terms_formulae text,
  add column if not exists lessons jsonb not null default '[]'::jsonb;
