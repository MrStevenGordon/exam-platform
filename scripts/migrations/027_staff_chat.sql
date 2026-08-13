-- Staff-to-staff messaging: 1:1 direct conversations plus one shared
-- staff-wide group channel. Additive, no existing tables touched.
--
-- Every profile in this database belongs to the same school (each school
-- runs its own separate Supabase project, cloned from this one via
-- scripts/provision-school-db.mjs), so unlike most tables here there is no
-- school_id to scope by. "Staff" means role in ('teacher','supervisor','admin').

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'staff_group')),
  created_at timestamp with time zone default now() not null
);

-- Exactly one staff_group conversation should ever exist. Created lazily
-- on first use (see get_or_create_staff_group below) rather than seeded,
-- so it works the same way on a freshly-provisioned school.
create unique index conversations_one_staff_group on public.conversations (type) where type = 'staff_group';

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamp with time zone default now() not null,
  last_read_at timestamp with time zone default now() not null,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamp with time zone default now() not null
);

create index messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Mirrors the profiles.role values actually used across the app (student,
-- teacher, supervisor, admin) — "staff" is everyone except student.
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('teacher', 'supervisor', 'admin')
  );
$$;

-- Existing profiles RLS scopes a teacher's visibility to their own
-- department (see "Users can read relevant profiles"), which is too
-- narrow for "who can I message" — a staff chat should span the whole
-- school. This is a narrow, purpose-built read path (id/name/role only)
-- rather than loosening profiles RLS itself.
create or replace function public.list_staff_directory()
returns table (id uuid, full_name text, role text)
language sql
security definer
set search_path to 'public'
as $$
  select p.id, p.full_name, p.role
  from profiles p
  where p.role in ('teacher', 'supervisor', 'admin')
  and coalesce(p.is_active, true) = true
  and public.is_staff()
  order by p.full_name;
$$;

-- Atomic find-or-create so the client never has to juggle the RLS
-- ordering problem of inserting a conversation before it has any
-- participants. Reuses an existing direct conversation between the same
-- two people instead of creating duplicates.
create or replace function public.start_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Only staff can start conversations';
  end if;
  if other_user_id = auth.uid() then
    raise exception 'Cannot start a conversation with yourself';
  end if;

  select cp1.conversation_id into existing_id
  from conversation_participants cp1
  join conversation_participants cp2 on cp1.conversation_id = cp2.conversation_id
  join conversations c on c.id = cp1.conversation_id
  where c.type = 'direct' and cp1.user_id = auth.uid() and cp2.user_id = other_user_id
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into conversations (type) values ('direct') returning id into new_id;
  insert into conversation_participants (conversation_id, user_id) values (new_id, auth.uid()), (new_id, other_user_id);

  return new_id;
end;
$$;

create or replace function public.get_or_create_staff_group()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  gid uuid;
begin
  if not public.is_staff() then
    raise exception 'Only staff can access the staff group';
  end if;

  select id into gid from conversations where type = 'staff_group' limit 1;
  if gid is not null then return gid; end if;

  insert into conversations (type) values ('staff_group')
  on conflict (type) where type = 'staff_group' do nothing
  returning id into gid;

  if gid is null then
    select id into gid from conversations where type = 'staff_group' limit 1;
  end if;

  return gid;
end;
$$;

-- Upserts a participant row (creating one lazily for staff_group members
-- who don't have one yet) so unread-count math works the same way for
-- both conversation types.
create or replace function public.mark_conversation_read(conv_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from conversations c
    where c.id = conv_id
    and (
      (c.type = 'staff_group' and public.is_staff())
      or (c.type = 'direct' and exists (select 1 from conversation_participants cp where cp.conversation_id = c.id and cp.user_id = auth.uid()))
    )
  ) then
    raise exception 'Not a participant of this conversation';
  end if;

  insert into conversation_participants (conversation_id, user_id, last_read_at)
  values (conv_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

create policy "staff view accessible conversations" on public.conversations
  for select using (
    (type = 'staff_group' and public.is_staff())
    or (type = 'direct' and exists (
      select 1 from conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid()
    ))
  );

create policy "users view participant rows in their conversations" on public.conversation_participants
  for select using (
    exists (
      select 1 from conversation_participants cp2
      where cp2.conversation_id = conversation_participants.conversation_id and cp2.user_id = auth.uid()
    )
  );

create policy "participants view messages in accessible conversations" on public.messages
  for select using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (
        (c.type = 'staff_group' and public.is_staff())
        or (c.type = 'direct' and exists (select 1 from conversation_participants cp where cp.conversation_id = c.id and cp.user_id = auth.uid()))
      )
    )
  );

create policy "participants send messages in accessible conversations" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (
        (c.type = 'staff_group' and public.is_staff())
        or (c.type = 'direct' and exists (select 1 from conversation_participants cp where cp.conversation_id = c.id and cp.user_id = auth.uid()))
      )
    )
  );

-- No client-side insert/update policy on conversations or
-- conversation_participants: every write to those two tables goes
-- through the SECURITY DEFINER functions above, which enforce the
-- access rules internally and sidestep the RLS insert-ordering problem
-- of adding participants before a row exists to reference.

alter publication supabase_realtime add table public.messages;
