-- 093: videos in Smart Learning.
--
-- WHAT: teachers and heads of department add LINKS to videos that live elsewhere (YouTube, Vimeo, Khan Academy). The school hosts nothing.
-- Students get a Shorts-style feed by subject (for their grade), with a low-data mode (no pictures, and a video loads only when tapped).
--
-- RULES (all kept here in the database, not only on screen)
--   * Only YouTube, Vimeo and Khan Academy links are accepted. Each link is read and checked by video_parse(); the player is built from the
--     checked video id, never from pasted text.
--   * A link added by a head of department, the principal team or the school admin is live at once. A link added by a teacher WAITS until the
--     head of that teacher's department (or the principal team or school admin) approves it. The teacher can still see and remove their own.
--   * Students see only approved videos for their grade. They can report a video; two different students reporting it hides it until a
--     head of department / principal / admin looks and approves it again.
--   * Students never see who reported, pending or hidden videos, or anything staff-only. Reports are written only by the report function.
--
-- Adds tables and functions only. Needs the topic list (migration 058) for the optional topic.
-- Roll back with scripts/migrations/rollback/093_learning_videos_rollback.sql

begin;

do $$
begin
  if to_regclass('public.curriculum_topics') is null then raise exception 'Apply migration 058 (the topic list) first.'; end if;
end $$;

create or replace function public.videos_ready() returns boolean language sql stable as $$ select true $$;
grant execute on function public.videos_ready() to authenticated;

-- Reads a pasted link. Returns nothing for a link that is not an accepted one. Same rules as src/lib/videosPure.ts.
create or replace function public.video_parse(p_url text)
returns table (provider text, external_id text, norm_url text)
language plpgsql immutable
as $$
declare
  s text := btrim(coalesce(p_url, ''));
  id text;
begin
  if s = '' or length(s) > 500 then return; end if;
  id := substring(s from '(?i)^https?://(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com)/(?:watch\?(?:[^#\s]*&)?v=|shorts/|embed/|live/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])');
  if id is null then id := substring(s from '(?i)^https?://youtu\.be/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])'); end if;
  if id is not null then return query select 'youtube'::text, id, 'https://www.youtube.com/watch?v=' || id; return; end if;
  id := substring(s from '(?i)^https?://(?:www\.|player\.)?vimeo\.com/(?:video/)?([0-9]{3,12})(?![0-9])');
  if id is not null then return query select 'vimeo'::text, id, 'https://vimeo.com/' || id; return; end if;
  id := substring(s from '(?i)^https?://(?:www\.)?khanacademy\.org/([^\s?#]+)');
  if id is not null then return query select 'khan'::text, left(md5(lower(id)), 16), 'https://www.khanacademy.org/' || id; return; end if;
end $$;
grant execute on function public.video_parse(text) to authenticated;

create table public.learning_videos (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('youtube', 'vimeo', 'khan')),
  external_id text not null,
  url text not null check (url like 'https://%' and length(url) <= 500),
  title text not null check (length(btrim(title)) between 1 and 150),
  note text check (note is null or length(note) <= 300),
  subject text not null check (length(btrim(subject)) between 1 and 100),
  topic_id uuid references public.curriculum_topics(id) on delete set null,
  grade_from smallint check (grade_from between 7 and 13),
  grade_to smallint check (grade_to between 7 and 13),
  added_by uuid not null references public.profiles(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,   -- the adder's department: its head decides on a teacher's link
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden', 'removed')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (grade_from is null or grade_to is null or grade_to >= grade_from),
  check ((provider = 'youtube' and external_id ~ '^[A-Za-z0-9_-]{11}$') or (provider = 'vimeo' and external_id ~ '^[0-9]{3,12}$') or (provider = 'khan' and external_id ~ '^[0-9a-f]{16}$' and url like 'https://www.khanacademy.org/%'))
);
create unique index learning_videos_one on public.learning_videos (provider, external_id) where status <> 'removed';
create index learning_videos_status on public.learning_videos (status, created_at desc);
create index learning_videos_added_by on public.learning_videos (added_by);

create table public.learning_video_reports (
  video_id uuid not null references public.learning_videos(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  reason text check (reason is null or length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (video_id, student_id)
);

alter table public.learning_videos enable row level security;
alter table public.learning_video_reports enable row level security;
revoke all on public.learning_videos, public.learning_video_reports from anon, authenticated, public;
-- no policies and no grants: every read and write goes through the functions below

-- Can the caller decide on this video (approve, hide, remove)? The head of the adder's department, the principal team, the school admin.
create or replace function public.video_can_manage(p_video uuid)
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v learning_videos; r text := public.my_role();
begin
  if auth.uid() is null then return false; end if;
  select * into v from learning_videos where id = p_video;
  if not found then return false; end if;
  if r in ('principal', 'admin') then return true; end if;
  return r = 'supervisor' and v.department_id is not null and v.department_id = public.my_supervised_department();
end $$;
revoke all on function public.video_can_manage(uuid) from public, anon;
grant execute on function public.video_can_manage(uuid) to authenticated;

-- ---------- read ----------
-- Students: approved videos for their grade. Staff: approved videos, their own, and (for those who decide) everything waiting or reported in scope.
create or replace function public.videos_list()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare r text := public.my_role(); me uuid := auth.uid(); v_grade integer; v_dept uuid := public.my_supervised_department();
begin
  if me is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if r is null then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select grade_level into v_grade from profiles where id = me;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', v.id, 'provider', v.provider, 'external_id', v.external_id, 'url', v.url, 'title', v.title, 'note', v.note, 'subject', v.subject,
      'topic_id', v.topic_id, 'topic', t.name, 'grade_from', v.grade_from, 'grade_to', v.grade_to,
      'added_by', v.added_by, 'added_by_name', p.full_name, 'status', v.status, 'created_at', v.created_at,
      'reports', case when r = 'student' then 0 else (select count(*) from learning_video_reports x where x.video_id = v.id) end,
      'can_edit', (r <> 'student' and (v.added_by = me or public.video_can_manage(v.id))),
      'can_manage', (r <> 'student' and public.video_can_manage(v.id))
    ) order by v.created_at desc)
    from learning_videos v
    join profiles p on p.id = v.added_by
    left join curriculum_topics t on t.id = v.topic_id
    where v.status <> 'removed' and (
      (v.status = 'approved' and (r <> 'student' or v_grade is null or ((v.grade_from is null or v_grade >= v.grade_from) and (v.grade_to is null or v_grade <= v.grade_to))))
      or (r <> 'student' and (v.added_by = me or public.video_can_manage(v.id)))
    )
  ), '[]'::jsonb);
end $$;
revoke all on function public.videos_list() from public, anon;
grant execute on function public.videos_list() to authenticated;

-- ---------- write ----------
create or replace function public.video_add(p_url text, p_title text, p_note text, p_subject text, p_topic uuid default null, p_grade_from integer default null, p_grade_to integer default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r text := public.my_role(); me uuid := auth.uid(); k record; v_dept uuid; v_id uuid; v_status text;
  v_title text := btrim(coalesce(p_title, '')); v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_subject text := btrim(coalesce(p_subject, ''));
begin
  if me is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if r is null or r not in ('teacher', 'supervisor', 'principal', 'admin') then raise exception 'Only staff can add videos.' using errcode = '42501'; end if;
  select * into k from public.video_parse(p_url);
  if not found then raise exception 'Use a YouTube, Vimeo or Khan Academy link.' using errcode = 'P0001'; end if;
  if v_title = '' or length(v_title) > 150 then raise exception 'Give the video a title (up to 150 characters).' using errcode = 'P0001'; end if;
  if v_subject = '' or length(v_subject) > 100 then raise exception 'Choose the subject.' using errcode = 'P0001'; end if;
  if length(coalesce(v_note, '')) > 300 then raise exception 'Keep the note under 300 characters.' using errcode = 'P0001'; end if;
  if (p_grade_from is not null and p_grade_from not between 7 and 13) or (p_grade_to is not null and p_grade_to not between 7 and 13) then raise exception 'Choose grades from 7 to 13.' using errcode = 'P0001'; end if;
  if p_grade_from is not null and p_grade_to is not null and p_grade_to < p_grade_from then raise exception 'The last grade cannot be before the first.' using errcode = 'P0001'; end if;
  if p_topic is not null and not exists (select 1 from curriculum_topics where id = p_topic and status <> 'archived') then raise exception 'That topic was not found.' using errcode = 'P0001'; end if;
  if exists (select 1 from learning_videos where provider = k.provider and external_id = k.external_id and status <> 'removed') then raise exception 'That video has already been added.' using errcode = 'P0001'; end if;
  select department_id into v_dept from profiles where id = me;
  v_status := case when r = 'teacher' then 'pending' else 'approved' end;
  insert into learning_videos (provider, external_id, url, title, note, subject, topic_id, grade_from, grade_to, added_by, department_id, status, decided_by, decided_at)
  values (k.provider, k.external_id, k.norm_url, v_title, v_note, v_subject, p_topic, p_grade_from, p_grade_to, me, v_dept, v_status,
          case when v_status = 'approved' then me end, case when v_status = 'approved' then now() end)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.video_add(text, text, text, text, uuid, integer, integer) from public, anon;
grant execute on function public.video_add(text, text, text, text, uuid, integer, integer) to authenticated;

-- Changes the wording, subject, topic or grades (never the link). A teacher changing a live video sends it back for approval.
create or replace function public.video_update(p_id uuid, p_title text, p_note text, p_subject text, p_topic uuid default null, p_grade_from integer default null, p_grade_to integer default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v learning_videos; me uuid := auth.uid(); mgr boolean;
  v_title text := btrim(coalesce(p_title, '')); v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_subject text := btrim(coalesce(p_subject, ''));
begin
  if me is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  select * into v from learning_videos where id = p_id and status <> 'removed';
  mgr := public.video_can_manage(p_id);
  if not found or not (v.added_by = me or mgr) or public.my_role() = 'student' then raise exception 'You cannot change this video.' using errcode = '42501'; end if;
  if v_title = '' or length(v_title) > 150 then raise exception 'Give the video a title (up to 150 characters).' using errcode = 'P0001'; end if;
  if v_subject = '' or length(v_subject) > 100 then raise exception 'Choose the subject.' using errcode = 'P0001'; end if;
  if length(coalesce(v_note, '')) > 300 then raise exception 'Keep the note under 300 characters.' using errcode = 'P0001'; end if;
  if (p_grade_from is not null and p_grade_from not between 7 and 13) or (p_grade_to is not null and p_grade_to not between 7 and 13) then raise exception 'Choose grades from 7 to 13.' using errcode = 'P0001'; end if;
  if p_grade_from is not null and p_grade_to is not null and p_grade_to < p_grade_from then raise exception 'The last grade cannot be before the first.' using errcode = 'P0001'; end if;
  if p_topic is not null and not exists (select 1 from curriculum_topics where id = p_topic and status <> 'archived') then raise exception 'That topic was not found.' using errcode = 'P0001'; end if;
  update learning_videos set title = v_title, note = v_note, subject = v_subject, topic_id = p_topic, grade_from = p_grade_from, grade_to = p_grade_to,
    status = case when not mgr and status = 'approved' then 'pending' else status end,
    decided_by = case when not mgr and status = 'approved' then null else decided_by end, decided_at = case when not mgr and status = 'approved' then null else decided_at end
  where id = p_id;
end $$;
revoke all on function public.video_update(uuid, text, text, text, uuid, integer, integer) from public, anon;
grant execute on function public.video_update(uuid, text, text, text, uuid, integer, integer) to authenticated;

-- Approve (also brings a hidden video back and clears its reports), hide, or remove: only those who decide.
create or replace function public.video_set_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if p_status is null or p_status not in ('approved', 'hidden', 'removed') then raise exception 'Choose approve, hide or remove.' using errcode = 'P0001'; end if;
  if not public.video_can_manage(p_id) then raise exception 'You cannot decide on this video.' using errcode = '42501'; end if;
  if not exists (select 1 from learning_videos where id = p_id and status <> 'removed') then raise exception 'That video was not found.' using errcode = 'P0001'; end if;
  update learning_videos set status = p_status, decided_by = auth.uid(), decided_at = now() where id = p_id;
  if p_status = 'approved' then delete from learning_video_reports where video_id = p_id; end if;
end $$;
revoke all on function public.video_set_status(uuid, text) from public, anon;
grant execute on function public.video_set_status(uuid, text) to authenticated;

-- The person who added a video can remove it.
create or replace function public.video_remove(p_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if public.my_role() = 'student' or not exists (select 1 from learning_videos where id = p_id and status <> 'removed' and added_by = auth.uid()) then
    raise exception 'You cannot remove this video.' using errcode = '42501';
  end if;
  update learning_videos set status = 'removed', decided_by = auth.uid(), decided_at = now() where id = p_id;
end $$;
revoke all on function public.video_remove(uuid) from public, anon;
grant execute on function public.video_remove(uuid) to authenticated;

-- A student reports a video that is wrong, unsafe or broken. Two different students hide it until staff look.
create or replace function public.video_report(p_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_grade integer; v learning_videos; n integer;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if public.my_role() <> 'student' then raise exception 'Only students report videos.' using errcode = '42501'; end if;
  if length(coalesce(p_reason, '')) > 200 then raise exception 'Keep the reason under 200 characters.' using errcode = 'P0001'; end if;
  select grade_level into v_grade from profiles where id = auth.uid();
  select * into v from learning_videos where id = p_id and status = 'approved'
    and (v_grade is null or ((grade_from is null or v_grade >= grade_from) and (grade_to is null or v_grade <= grade_to)));
  if not found then raise exception 'That video is not available.' using errcode = 'P0001'; end if;
  insert into learning_video_reports (video_id, student_id, reason) values (p_id, auth.uid(), nullif(btrim(coalesce(p_reason, '')), '')) on conflict do nothing;
  select count(*) into n from learning_video_reports where video_id = p_id;
  if n >= 2 then update learning_videos set status = 'hidden' where id = p_id and status = 'approved'; end if;
end $$;
revoke all on function public.video_report(uuid, text) from public, anon;
grant execute on function public.video_report(uuid, text) to authenticated;

commit;

select 'Migration 093 applied' as result;
