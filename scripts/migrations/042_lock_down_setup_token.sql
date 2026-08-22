-- Critical security fix: school_settings.setup_token was readable by
-- anyone via a direct PostgREST call, even though the row-level SELECT
-- policy "Everyone can view school settings" is intentionally permissive
-- (logo_url, enabled_features, subscription_active/expires_at all have
-- genuine pre-auth or anon-key client reads -- see login/page.tsx,
-- Sidebar.tsx, schoolFeatures.ts).
--
-- setup_token is the one-time bootstrap secret a brand-new school's first
-- admin claims via /school-setup/[token] -- the API route that validates it
-- (src/app/api/school-setup/verify-token/route.ts) already uses the
-- service-role key specifically because its own comment says the token
-- "must never be readable via a direct client-side query." But the table's
-- row-level policy has no column restriction, so `GET
-- .../school_settings?select=setup_token` with the public anon key returned
-- the live token for any school mid-onboarding -- enough to claim that
-- school's admin account before its real contact ever does.
--
-- Postgres RLS is row-level only. A plain column-level REVOKE does NOT work
-- here on its own: Supabase's default table-level `GRANT SELECT ON
-- school_settings TO anon, authenticated` already covers every column and
-- takes precedence, so a first attempt at this migration (a bare column
-- REVOKE, superseded by this version) silently had no effect -- verified by
-- round-tripping a real token through the anon REST endpoint before and
-- after. The fix has to revoke the table-wide SELECT first, then grant it
-- back only for the columns real client code actually reads.

revoke select on public.school_settings from anon, authenticated;
grant select (id, logo_url, updated_at, enabled_features, subscription_active, subscription_expires_at)
  on public.school_settings to anon, authenticated;
