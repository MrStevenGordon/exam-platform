-- Online / away / offline status.
--
-- Each signed-in browser sends a heartbeat about once a minute saying whether
-- the person is actively using the page. The DATABASE clock decides the state:
--   online   a heartbeat in the last 2.5 minutes AND the person was active in the last 3
--   away     a heartbeat in the last 2.5 minutes, but no activity for 3 minutes
--   offline  signed out, or no heartbeat for 2.5 minutes (tab closed, computer asleep, ...)
--
-- WHO CAN SEE WHOM (enforced here, not just on screen):
--   principal / school admin  everyone
--   teacher / HOD             all staff, and students they teach (via a class group
--                             they are assigned to, or a timetable class)
--   student                   nobody
--
-- The table has no read or write policies: everything goes through the functions
-- below, so nobody can read the raw table or fake someone else's status.
--
-- Roll back with scripts/migrations/rollback/057_online_presence_rollback.sql

begin;

create table public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz,
  last_active_at timestamptz,
  signed_out boolean not null default false
);
alter table public.user_presence enable row level security;

create or replace function public.presence_online_seconds() returns int language sql immutable as $$ select 150 $$;
create or replace function public.presence_active_seconds() returns int language sql immutable as $$ select 180 $$;

-- "I'm here." p_active = the person has touched the page recently.
create or replace function public.presence_heartbeat(p_active boolean default true)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  insert into user_presence (user_id, last_seen_at, last_active_at, signed_out)
  values (auth.uid(), now(), case when p_active then now() end, false)
  on conflict (user_id) do update
    set last_seen_at = now(),
        last_active_at = case when p_active then now() else user_presence.last_active_at end,
        signed_out = false;
end;
$$;

-- Signing out marks the person offline straight away.
create or replace function public.presence_signout()
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return; end if;
  update user_presence set signed_out = true where user_id = auth.uid();
end;
$$;

-- Status for a list of people, limited to the ones the caller is allowed to see.
-- Anyone not allowed is simply left out of the result.
create or replace function public.presence_for(p_ids uuid[])
returns table (user_id uuid, state text, last_seen_at timestamptz)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_role text;
  v_all boolean;
begin
  if auth.uid() is null then return; end if;
  select role into v_role from profiles where id = auth.uid();
  if v_role is null or v_role = 'student' then return; end if;
  v_all := v_role in ('principal', 'admin');

  return query
  select t.id,
         case
           when up.user_id is null or up.signed_out or up.last_seen_at is null
                or up.last_seen_at <= now() - make_interval(secs => public.presence_online_seconds()) then 'offline'
           when up.last_active_at is not null and up.last_active_at > now() - make_interval(secs => public.presence_active_seconds()) then 'online'
           else 'away'
         end,
         up.last_seen_at
  from profiles t
  left join user_presence up on up.user_id = t.id
  where t.id = any (p_ids[1:500])
    and (
      v_all
      or t.id = auth.uid()
      or t.role in ('teacher', 'supervisor', 'admin', 'principal')
      or public.is_teacher_of_class_student(t.id)
      or public.is_teacher_of_timetable_student(t.id)
    );
end;
$$;

-- Head counts for the principal's overview.
create or replace function public.presence_summary()
returns table (staff_online int, staff_away int, students_online int, students_away int)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  perform public.require_oversight();
  return query
  with s as (
    select p.role,
           case
             when up.user_id is null or up.signed_out or up.last_seen_at is null
                  or up.last_seen_at <= now() - make_interval(secs => public.presence_online_seconds()) then 'offline'
             when up.last_active_at is not null and up.last_active_at > now() - make_interval(secs => public.presence_active_seconds()) then 'online'
             else 'away'
           end as state
    from profiles p
    left join user_presence up on up.user_id = p.id
    where coalesce(p.is_active, true)
  )
  select
    (count(*) filter (where role in ('teacher', 'supervisor', 'admin', 'principal') and state = 'online'))::int,
    (count(*) filter (where role in ('teacher', 'supervisor', 'admin', 'principal') and state = 'away'))::int,
    (count(*) filter (where role = 'student' and state = 'online'))::int,
    (count(*) filter (where role = 'student' and state = 'away'))::int
  from s;
end;
$$;

revoke execute on function
  public.presence_heartbeat(boolean), public.presence_signout(), public.presence_for(uuid[]), public.presence_summary()
from public, anon;
grant execute on function
  public.presence_heartbeat(boolean), public.presence_signout(), public.presence_for(uuid[]), public.presence_summary()
to authenticated;

commit;
