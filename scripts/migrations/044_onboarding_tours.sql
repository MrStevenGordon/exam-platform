-- Tracks which first-login onboarding tours a user has completed, keyed by
-- role (e.g. 'teacher'). JSONB rather than one boolean column per role so
-- adding a tour for another role later (student, supervisor, ...) needs no
-- further migration -- same pattern as school_settings.enabled_features.
--
-- Self-service: a user marks their own tours seen via the existing "Users
-- can update own profile" policy (auth.uid() = id) -- no new RLS needed.

alter table public.profiles
  add column onboarding_tours_seen jsonb not null default '{}'::jsonb;
