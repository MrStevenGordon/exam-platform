-- Removes online/offline status (the recorded heartbeats are deleted).
begin;
drop function if exists public.presence_summary();
drop function if exists public.presence_for(uuid[]);
drop function if exists public.presence_signout();
drop function if exists public.presence_heartbeat(boolean);
drop function if exists public.presence_active_seconds();
drop function if exists public.presence_online_seconds();
drop table if exists public.user_presence;
commit;
