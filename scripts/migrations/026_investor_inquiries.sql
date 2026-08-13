-- Coming-soon page investor/backer inquiries. Additive, no existing tables touched.

create table public.investor_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  firm text,
  note text,
  submitted_at timestamp with time zone default now() not null
);

alter table public.investor_inquiries enable row level security;

create policy "anyone can submit an investor inquiry" on public.investor_inquiries
  for insert to authenticated, anon with check (true);

-- Reuses the same is_system_admin() SECURITY DEFINER helper introduced in
-- 002_school_requests.sql.
create policy "system admins view investor inquiries" on public.investor_inquiries
  for select using (public.is_system_admin());
