-- Subscription billing for the organization tier.
--
-- Security note: subscription/billing state is deliberately its OWN table
-- rather than new columns on `organizations`. The existing `organizations`
-- RLS policy ("org owns its own row") is `for all`, which includes UPDATE —
-- if subscription_status lived directly on that table, any organization
-- could set its own status to 'active' via a normal client update call.
-- organization_subscriptions instead has a SELECT-only policy for the org;
-- every write happens through the service-role key (Stripe webhook, the
-- checkout route, or the admin bank-transfer confirmation route), never
-- from the browser.
--
-- Depends on public.is_system_admin(), created in migration 002.


create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'active', 'past_due', 'canceled')),
  subscription_plan text check (subscription_plan in ('3_month', '6_month', 'yearly')),
  current_period_end timestamp with time zone,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamp with time zone default now() not null
);

create table public.organization_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan text not null check (plan in ('3_month', '6_month', 'yearly')),
  method text not null check (method in ('card', 'bank_transfer')),
  amount_usd numeric not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  reference_note text,
  submitted_at timestamp with time zone default now() not null,
  confirmed_at timestamp with time zone,
  confirmed_by uuid references auth.users(id)
);

-- Bank details shown to an organization choosing bank transfer — a single
-- admin-editable row, so real account details never live in source code or
-- env vars. Same "single settings row" pattern as the existing
-- school_settings table.
create table public.platform_billing_settings (
  id uuid primary key default gen_random_uuid(),
  bank_name text,
  account_name text,
  account_number text,
  routing_or_swift text,
  instructions text,
  updated_at timestamp with time zone default now() not null
);

create index organization_payments_organization_id_idx on public.organization_payments(organization_id);

alter table public.organization_subscriptions enable row level security;
alter table public.organization_payments enable row level security;
alter table public.platform_billing_settings enable row level security;

create policy "org reads its own subscription" on public.organization_subscriptions
  for select using (
    organization_id in (select id from public.organizations where auth_user_id = auth.uid())
  );

create policy "system admins manage subscriptions" on public.organization_subscriptions
  for all using (public.is_system_admin())
  with check (public.is_system_admin());

create policy "org manages its own payment submissions" on public.organization_payments
  for select using (
    organization_id in (select id from public.organizations where auth_user_id = auth.uid())
  );

create policy "org submits its own payment" on public.organization_payments
  for insert with check (
    organization_id in (select id from public.organizations where auth_user_id = auth.uid())
    and status = 'pending' and method = 'bank_transfer'
  );

create policy "system admins manage payments" on public.organization_payments
  for all using (public.is_system_admin())
  with check (public.is_system_admin());

create policy "any authenticated org can view billing settings" on public.platform_billing_settings
  for select to authenticated using (true);

create policy "system admins manage billing settings" on public.platform_billing_settings
  for all using (public.is_system_admin())
  with check (public.is_system_admin());
