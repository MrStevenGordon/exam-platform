-- Coming-soon page waitlist signups. Additive, no existing tables touched.

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  school_name text,
  submitted_at timestamp with time zone default now() not null
);

create unique index waitlist_signups_email_key on public.waitlist_signups (lower(email));

alter table public.waitlist_signups enable row level security;

create policy "anyone can join the waitlist" on public.waitlist_signups
  for insert to authenticated, anon with check (true);

-- Reuses the same is_system_admin() SECURITY DEFINER helper introduced in
-- 002_school_requests.sql.
create policy "system admins view waitlist signups" on public.waitlist_signups
  for select using (public.is_system_admin());
