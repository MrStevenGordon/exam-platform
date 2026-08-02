-- "Build My School" request intake. Additive, no existing tables touched.

create table public.school_requests (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  contact_name text not null,
  contact_email text not null,
  workflow_template text not null check (workflow_template in ('direct_publish', 'department_review', 'full_review')),
  feature_flags jsonb not null default '[]',
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamp with time zone default now() not null,
  reviewed_at timestamp with time zone,
  reviewed_by uuid references auth.users(id)
);

alter table public.school_requests enable row level security;

-- Mirrors the existing public.is_admin() function/pattern, just checking
-- is_system_admin instead of role — reused by every owner-only policy added
-- this session (school_requests, organization billing tables).
create or replace function public.is_system_admin()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_system_admin = true
  );
$$;

create policy "anyone can submit a school request" on public.school_requests
  for insert to authenticated, anon with check (true);

-- Uses public.is_system_admin() (SECURITY DEFINER, checks profiles directly)
-- rather than the JWT's app_metadata claim — nothing in this project syncs
-- profiles.is_system_admin into that claim, so a JWT-only check would never
-- actually pass for anyone. Matches the existing is_admin() pattern.
create policy "system admins manage school requests" on public.school_requests
  for all using (public.is_system_admin())
  with check (public.is_system_admin());
