-- Subscription billing + license keys for schools, mirroring
-- organization_subscriptions. Kept as its own table rather than columns on
-- school_settings for the same reason: school_settings has a public SELECT
-- policy ("Everyone can view school settings" USING (true)), so a
-- license_key column there would be world-readable.
--
-- There's no central "schools" table (each school is meant to eventually
-- get its own separate Supabase project — school_requests is only the
-- pre-provisioning signup record). school_request_id is nullable so a
-- school that predates that flow (Manchester High) can still be granted a
-- subscription by name/email alone.
--
-- Depends on public.is_system_admin(), created in migration 002.

create table public.school_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_request_id uuid references public.school_requests(id) on delete set null,
  school_name text not null,
  contact_email text not null,
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'active', 'past_due', 'canceled')),
  subscription_plan text check (subscription_plan in ('3_month', '6_month', 'yearly')),
  current_period_end timestamp with time zone,
  license_key text unique,
  approved_by uuid references auth.users(id),
  approved_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index school_subscriptions_school_request_id_idx on public.school_subscriptions(school_request_id);

alter table public.school_subscriptions enable row level security;

-- No self-service portal for schools yet (unlike organizations) — only the
-- owner reads/writes this table, always through the admin UI / service role.
create policy "system admins manage school subscriptions" on public.school_subscriptions
  for all using (public.is_system_admin())
  with check (public.is_system_admin());
