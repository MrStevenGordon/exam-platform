-- 101: teachers' videos go live at once (no head-of-department approval).
--
-- WHAT: until now a link added by a teacher WAITED until the head of their department approved it, and a teacher who edited a live video sent
-- it back for approval. Both are removed: a teacher's link is live as soon as it is added, and editing the wording keeps it live.
--
-- STILL IN PLACE (unchanged from 093): only YouTube, Vimeo and Khan Academy links are accepted; two different students reporting a video hides it
-- until a head of department / principal / admin looks and approves it again; a head of department, the principal team and the school admin can
-- still hide or remove any video in scope; students see only live videos for their grade.
--
-- Also makes live any teacher video that is still waiting, since there is no approval step any more.
-- Replaces two functions only (video_add, video_update). No tables change.
-- Roll back with scripts/migrations/rollback/101_teacher_videos_live_rollback.sql

begin;

do $$
begin
  if to_regclass('public.learning_videos') is null then raise exception 'Apply migration 093 (videos) first.'; end if;
end $$;

-- Adds a video link. Every staff member's link is live at once.
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
  -- Teachers' links are live at once, like a head of department's (migration 101). Reports and the head's right to hide still apply.
  v_status := 'approved';
  insert into learning_videos (provider, external_id, url, title, note, subject, topic_id, grade_from, grade_to, added_by, department_id, status, decided_by, decided_at)
  values (k.provider, k.external_id, k.norm_url, v_title, v_note, v_subject, p_topic, p_grade_from, p_grade_to, me, v_dept, v_status,
          case when v_status = 'approved' then me end, case when v_status = 'approved' then now() end)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.video_add(text, text, text, text, uuid, integer, integer) from public, anon;
grant execute on function public.video_add(text, text, text, text, uuid, integer, integer) to authenticated;

-- Changes the wording, subject, topic or grades (never the link). The video stays as it was: live stays live.
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
    status = status
  where id = p_id;
end $$;
revoke all on function public.video_update(uuid, text, text, text, uuid, integer, integer) from public, anon;
grant execute on function public.video_update(uuid, text, text, text, uuid, integer, integer) to authenticated;

-- Anything still waiting goes live.
update public.learning_videos set status = 'approved', decided_at = now() where status = 'pending';

commit;
