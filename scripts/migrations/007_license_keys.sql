-- License keys for organization subscriptions, plus an approval audit
-- trail. The key is a stable reference code (shown to the org, kept across
-- renewals) — it doesn't gate anything yet. A future redeem/activate flow
-- for the desktop app can build on top of it without a schema change.

alter table public.organization_subscriptions add column if not exists license_key text unique;
alter table public.organization_subscriptions add column if not exists approved_by uuid references auth.users(id);
alter table public.organization_subscriptions add column if not exists approved_at timestamp with time zone;
