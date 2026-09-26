-- Smart Assess Play: hardening for a HOSTED database (Supabase).
--
-- Supabase publishes every table and function in the public schema over its REST API, callable with the
-- project's public key. Play talks to its database only from the server (a direct connection as the
-- database owner), never through that API, so nothing here should be reachable that way at all. This:
--   * turns on row-level security for every Play table, with NO policies (so any role that is not the
--     owner sees and changes nothing),
--   * removes every privilege on tables, sequences, views and functions from the public roles,
--   * does the same for anything created later,
--   * gives the two sign-in functions a fixed search path (they are security definer).
-- The owner (the role the app connects with) is unaffected. Safe to run more than once, and safe on a plain
-- Postgres that has no anon/authenticated roles (they are skipped). Run scripts/play/check_hosted.mjs after.
-- Roll back with scripts/play/rollback/012_hosted_hardening_rollback.sql.

do $$
declare
  t record;
  r text;
begin
  for t in select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname like 'play\_%' and c.relkind in ('r', 'p') loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;

  foreach r in array array['public', 'anon', 'authenticated'] loop
    if r = 'public' or exists (select 1 from pg_roles where rolname = r) then
      for t in select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relname like 'play\_%' and c.relkind in ('r', 'p', 'v', 'm', 'S') loop
        if t.relkind = 'S' then
          execute format('revoke all on sequence public.%I from %s', t.relname, case when r = 'public' then 'public' else quote_ident(r) end);
        else
          execute format('revoke all on table public.%I from %s', t.relname, case when r = 'public' then 'public' else quote_ident(r) end);
        end if;
      end loop;
      for t in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname like 'play\_%' loop
        execute format('revoke all on function %s from %s', t.sig, case when r = 'public' then 'public' else quote_ident(r) end);
      end loop;
    end if;
  end loop;

  -- Anything Play adds later starts closed too.
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end $$;

-- The sign-in functions are security definer: fix their search path so it cannot be steered.
-- (pgcrypto lives in "extensions" on Supabase and in "public" on a plain Postgres.)
alter function play_verify_login(text, text) set search_path = public, extensions, pg_temp;
alter function play_login_locked(text) set search_path = public, extensions, pg_temp;
