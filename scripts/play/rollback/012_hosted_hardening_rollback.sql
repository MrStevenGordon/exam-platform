-- Rolls back 012: turns row-level security off for the Play tables again. It does NOT hand the public roles
-- their privileges back (they should never have them; restoring them would re-open the public interface).
-- If you truly need that on a hosted database, grant deliberately.
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname like 'play\_%' and c.relkind in ('r', 'p') loop
    execute format('alter table public.%I disable row level security', t.relname);
  end loop;
end $$;
alter function play_verify_login(text, text) reset search_path;
alter function play_login_locked(text) reset search_path;
