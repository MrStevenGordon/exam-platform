-- The AI tutor is a two-key decision: the platform owner makes it available to a school (the
-- existing ai_tutor_enabled flag), and now the school's own leadership must separately agree to
-- its terms before students can actually use it. Both must be true for the tutor to run — see
-- src/lib/tutorClient.ts and src/app/api/learning/tutor/route.ts.
--
-- ai_tutor_consent: null (not yet decided) | 'accepted' | 'declined'
-- ai_tutor_consent_by / _at: who decided and when, for accountability — shown back to the
-- principal team on the decision screen.
--
-- A decline (or never deciding) blocks the tutor even if the owner has switched it on; declining
-- after a prior acceptance takes effect immediately, since both gates are checked on every request.
--
-- Roll back with scripts/migrations/rollback/071_ai_tutor_consent_rollback.sql

begin;

alter table public.school_settings
  add column if not exists ai_tutor_consent text check (ai_tutor_consent in ('accepted', 'declined')),
  add column if not exists ai_tutor_consent_by uuid references public.profiles(id) on delete set null,
  add column if not exists ai_tutor_consent_at timestamptz;

commit;
