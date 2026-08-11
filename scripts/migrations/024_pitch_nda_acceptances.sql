-- Records who agreed to the NDA gate before viewing a pitch deck. Additive,
-- no existing tables touched.

create table public.pitch_nda_acceptances (
  id uuid primary key default gen_random_uuid(),
  deck text not null,
  name text not null,
  email text not null,
  ip text,
  user_agent text,
  accepted_at timestamp with time zone default now() not null
);

alter table public.pitch_nda_acceptances enable row level security;

create policy "anyone can record an nda acceptance" on public.pitch_nda_acceptances
  for insert to authenticated, anon with check (true);

-- Reuses the same is_system_admin() SECURITY DEFINER helper introduced in
-- 002_school_requests.sql.
create policy "system admins view nda acceptances" on public.pitch_nda_acceptances
  for select using (public.is_system_admin());
