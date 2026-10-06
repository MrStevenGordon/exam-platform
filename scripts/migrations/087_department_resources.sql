-- 087: teacher resource space (Smart Learning).
--
-- A shared shelf for each department: teachers add links and files (worksheets, past papers, slides) tagged by subject, grade and topic, and
-- colleagues in the same department find them. The head of department can pin the best ones to the top.
--
-- WHO CAN DO WHAT
--   * see and open     teachers and heads of department who belong to the department (their own department, or a department they teach a
--                      subject in), and the school admin. NEVER students, and never a teacher from another department.
--   * share            a teacher or head of department, into a department they belong to. Only as themselves.
--   * edit / remove    the person who shared it. The head of the department and the school admin can remove anything in their department.
--   * pin / unpin      the head of the department only. Nobody else can pin, not even by editing their own item.
--   The database enforces all of this (row rules, a guard on every change, and rules on the file bucket); the screen only mirrors it.
--
-- FILES go in a PRIVATE bucket (department-resources), up to 20 MB each, documents and pictures only. They are opened through a short-lived
-- link made for the person asking, never a public address. The first part of every file's path is its department, and the bucket rules check
-- that the person belongs to that department.
--
-- LIMITS: 300 items per person; titles 150 characters; descriptions 1000; links must be https.
-- Needs the topic list (058). Adds one table, six functions and a bucket. Nothing existing changes.
-- Roll back with scripts/migrations/rollback/087_department_resources_rollback.sql

begin;

do $$
begin
  if to_regclass('public.curriculum_topics') is null then
    raise exception 'Apply migration 058 (the topic list) first.';
  end if;
end $$;

-- ---------- who belongs to a department ----------
create or replace function public.resource_is_member(p_dept uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_dept is not null and (
    exists (
      select 1 from profiles p
       where p.id = auth.uid() and coalesce(p.is_active, true) and p.role in ('teacher', 'supervisor')
         and (p.department_id = p_dept
              or exists (select 1 from teacher_subjects ts where ts.teacher_id = p.id and ts.department_id = p_dept))
    )
    or exists (select 1 from departments d join profiles p on p.id = auth.uid() where d.id = p_dept and d.head_id = auth.uid() and coalesce(p.is_active, true))
  )
$$;

create or replace function public.resource_is_head(p_dept uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_dept is not null and (
    exists (select 1 from departments d where d.id = p_dept and d.head_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'supervisor' and p.department_id = p_dept and coalesce(p.is_active, true))
  )
$$;

-- For file paths such as '<department id>/<file>': is the caller a member of that department?
create or replace function public.resource_path_ok(p_name text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+'
         and public.resource_is_member(split_part(p_name, '/', 1)::uuid)
$$;

-- ---------- the table ----------
create table public.department_resources (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (btrim(title) <> '' and length(title) <= 150),
  description text not null default '' check (length(description) <= 1000),
  kind text not null check (kind in ('link', 'file')),
  url text check (url is null or (url ~* '^https://[^[:space:]]+$' and length(url) <= 2000)),
  file_path text check (file_path is null or length(file_path) <= 400),
  file_name text check (file_name is null or length(file_name) <= 200),
  file_size bigint check (file_size is null or (file_size > 0 and file_size <= 20971520)),
  mime_type text check (mime_type is null or length(mime_type) <= 120),
  subject text check (subject is null or length(subject) <= 100),
  grade int check (grade is null or grade between 7 and 13),
  topic_id uuid references public.curriculum_topics(id) on delete set null,
  pinned boolean not null default false,
  pinned_by uuid references public.profiles(id) on delete set null,
  pinned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint department_resources_kind_fields check (
    (kind = 'link' and url is not null and file_path is null and file_name is null)
    or (kind = 'file' and file_path is not null and file_name is not null and url is null)
  ),
  -- a file's path must start with its own department, so the bucket rules and the row always agree
  constraint department_resources_path_in_department check (file_path is null or file_path like department_id::text || '/%')
);
create index department_resources_dept_idx on public.department_resources (department_id, pinned desc, created_at desc);
create index department_resources_owner_idx on public.department_resources (created_by);

-- ---------- a guard on every change ----------
create or replace function public.trg_department_resources_guard()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from department_resources where created_by = new.created_by) >= 300 then
      raise exception 'You can share up to 300 resources. Remove one you no longer need.' using errcode = 'P0001';
    end if;
    if new.pinned then
      if not public.resource_is_head(new.department_id) then raise exception 'Only the head of department can pin.' using errcode = '42501'; end if;
      new.pinned_by := auth.uid(); new.pinned_at := now();
    else
      new.pinned_by := null; new.pinned_at := null;
    end if;
    return new;
  end if;

  -- updates
  if new.department_id <> old.department_id or new.created_by <> old.created_by or new.kind <> old.kind or new.file_path is distinct from old.file_path then
    raise exception 'A resource cannot change department, owner, type or file.' using errcode = 'P0001';
  end if;
  if new.pinned is distinct from old.pinned then
    if not public.resource_is_head(old.department_id) then raise exception 'Only the head of department can pin or unpin.' using errcode = '42501'; end if;
    if new.pinned then new.pinned_by := auth.uid(); new.pinned_at := now(); else new.pinned_by := null; new.pinned_at := null; end if;
  else
    new.pinned_by := old.pinned_by; new.pinned_at := old.pinned_at;
  end if;
  if auth.uid() is distinct from old.created_by then
    -- the head (or anyone else allowed to update) may change nothing but the pin
    if new.title is distinct from old.title or new.description is distinct from old.description or new.url is distinct from old.url
       or new.file_name is distinct from old.file_name or new.file_size is distinct from old.file_size or new.mime_type is distinct from old.mime_type
       or new.subject is distinct from old.subject or new.grade is distinct from old.grade or new.topic_id is distinct from old.topic_id then
      raise exception 'Only the person who shared this can edit it.' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger department_resources_guard before insert or update on public.department_resources
  for each row execute function public.trg_department_resources_guard();

-- ---------- row rules ----------
alter table public.department_resources enable row level security;
create policy "Department members see their department's resources" on public.department_resources
  for select using (public.resource_is_member(department_id) or public.is_admin());
create policy "Members share into their own department" on public.department_resources
  for insert with check (created_by = auth.uid() and public.resource_is_member(department_id));
create policy "Owner or head update" on public.department_resources
  for update using (created_by = auth.uid() or public.resource_is_head(department_id))
  with check (created_by = auth.uid() or public.resource_is_head(department_id));
create policy "Owner, head or admin remove" on public.department_resources
  for delete using (created_by = auth.uid() or public.resource_is_head(department_id) or public.is_admin());

revoke all on public.department_resources from anon, public;
grant select, insert, update, delete on public.department_resources to authenticated;

-- ---------- the private file bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('department-resources', 'department-resources', false, 20971520, array[
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Department members add resource files" on storage.objects
  for insert to authenticated with check (bucket_id = 'department-resources' and public.resource_path_ok(name));
create policy "Department members read resource files" on storage.objects
  for select to authenticated using (bucket_id = 'department-resources' and (public.resource_path_ok(name) or public.is_admin()));
-- the uploader can always remove their own upload (including one whose resource was never saved); heads and admins remove others' files
create policy "Owners and heads remove resource files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'department-resources' and (
      owner_id = auth.uid()::text
      or exists (select 1 from public.department_resources r where r.file_path = storage.objects.name
                   and (r.created_by = auth.uid() or public.resource_is_head(r.department_id) or public.is_admin()))
    )
  );

-- ---------- what the screen asks ----------
create or replace function public.department_resources_ready()
returns boolean language sql immutable as $$ select true $$;

-- The departments the caller can use: where they can share, and whether they are the head (can pin). The school admin sees them all (can remove, not share).
create or replace function public.resources_my_departments()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'is_head', public.resource_is_head(d.id), 'can_share', public.resource_is_member(d.id)) order by d.name), '[]'::jsonb)
    from departments d
   where public.resource_is_member(d.id) or public.is_admin()
$$;

-- A department's resources, newest first with pinned ones at the top, with the sharer's name and what the caller may do with each.
create or replace function public.department_resources_list(p_dept uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not (public.resource_is_member(p_dept) or public.is_admin()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id, 'title', r.title, 'description', r.description, 'kind', r.kind, 'url', r.url, 'file_path', r.file_path, 'file_name', r.file_name,
             'file_size', r.file_size, 'subject', r.subject, 'grade', r.grade, 'topic_id', r.topic_id, 'topic_name', t.name,
             'pinned', r.pinned, 'created_at', r.created_at, 'shared_by', coalesce(p.full_name, 'A colleague'), 'mine', r.created_by = auth.uid(),
             'can_edit', r.created_by = auth.uid(), 'can_remove', r.created_by = auth.uid() or public.resource_is_head(r.department_id) or public.is_admin(),
             'can_pin', public.resource_is_head(r.department_id))
           order by r.pinned desc, r.created_at desc)
      from (select * from department_resources where department_id = p_dept order by pinned desc, created_at desc limit 500) r
      left join profiles p on p.id = r.created_by
      left join curriculum_topics t on t.id = r.topic_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.resource_is_member(uuid), public.resource_is_head(uuid), public.resource_path_ok(text),
  public.resources_my_departments(), public.department_resources_list(uuid) from public, anon;
grant execute on function public.resource_is_member(uuid), public.resource_is_head(uuid), public.resource_path_ok(text),
  public.resources_my_departments(), public.department_resources_list(uuid), public.department_resources_ready() to authenticated;

commit;
select 'Migration 087 applied' as result;
