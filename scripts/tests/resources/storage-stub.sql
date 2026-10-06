-- A minimal stand-in for Supabase's storage tables, so the file rules in migration 087 can be tested on a throwaway database.
-- Run it ONCE on the throwaway database BEFORE applying 087. Never run on a real database.
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant all on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
