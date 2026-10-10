-- 100: study guides for lessons (Smart Learning).
--
-- WHAT THIS IS
-- A lesson already holds the teacher's five steps, key terms, subject, grade and topic, and the teacher has already approved it. A
-- STUDY GUIDE is a short companion built from that lesson: a few key points, a "what you should be able to do" list, and key-term
-- flashcards. It is drafted by AI from the lesson text, checked by the teacher once, and only then shown to students. The practice
-- QUESTIONS for a guide are the lesson's existing check questions (migrations 060 and 086); nothing here stores a second set.
--
-- SHAPE
--   learning_lesson_guides   one row per lesson: key points, can-do list, cards, and whether the teacher has switched it on.
--   learning_guide_reports   a student saying "something looks wrong" about one item, so a teacher can fix it.
--
-- RULES
--   * Students have NO access to either table. They read a guide only through learning_get_guide(), which applies the same access
--     rule as the lesson itself (published, given to their class, not closed) and shows a guide only once it is switched on.
--   * A guide can never hold a web address (so a link the teacher did not choose cannot reach a student) and is limited to 8 key
--     points, 8 can-do lines and 30 cards, with the same text limits as flashcards.
--   * Saving or switching on a guide records the lesson text it was checked against. If the lesson is edited afterwards the teacher
--     sees "the lesson has changed since this guide was checked".
--   * Practice results are not marks. Nothing here reads or writes anything in Smart Assess.
--
-- Needs 059 (Smart Learning). Roll back with scripts/migrations/rollback/100_lesson_study_guides_rollback.sql
-- (this deletes every guide and every report).

begin;

-- ---- the shape of a guide ---------------------------------------------------------------------------------------------------

create or replace function public.learning_guide_valid(p_key_points jsonb, p_can_do jsonb, p_cards jsonb)
returns boolean
language plpgsql immutable
as $$
declare
  x jsonb;
  t text;
begin
  if jsonb_typeof(p_key_points) is distinct from 'array' or jsonb_array_length(p_key_points) > 8 then return false; end if;
  if jsonb_typeof(p_can_do) is distinct from 'array' or jsonb_array_length(p_can_do) > 8 then return false; end if;
  if jsonb_typeof(p_cards) is distinct from 'array' or jsonb_array_length(p_cards) > 30 then return false; end if;

  for x in select jsonb_array_elements(p_key_points) union all select jsonb_array_elements(p_can_do) loop
    if jsonb_typeof(x) is distinct from 'string' then return false; end if;
    t := x #>> '{}';
    if btrim(t) = '' or length(t) > 300 or t ~* '(https?://|www\.)' then return false; end if;
  end loop;

  for x in select jsonb_array_elements(p_cards) loop
    if jsonb_typeof(x) is distinct from 'object' then return false; end if;
    if jsonb_typeof(x -> 'front') is distinct from 'string' or jsonb_typeof(x -> 'back') is distinct from 'string' then return false; end if;
    if btrim(x ->> 'front') = '' or length(x ->> 'front') > 500 or btrim(x ->> 'back') = '' or length(x ->> 'back') > 1000 then return false; end if;
    if (x ->> 'front') ~* '(https?://|www\.)' or (x ->> 'back') ~* '(https?://|www\.)' then return false; end if;
    if x ? 'step' and jsonb_typeof(x -> 'step') not in ('string', 'null') then return false; end if;
    if jsonb_typeof(x -> 'step') = 'string' and (x ->> 'step') not in ('engage', 'explore', 'explain', 'elaborate', 'evaluate') then return false; end if;
  end loop;
  return true;
end;
$$;

-- A fingerprint of the lesson's text (the five steps and the key terms), used to tell whether a guide was checked against the
-- lesson as it is now. The lesson's owner and the school admin can ask; a signed-in server job (no person) can too.
create or replace function public.learning_lesson_text_hash(p_lesson_id uuid)
returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v text;
begin
  if auth.uid() is not null and not (public.learning_owns_lesson(p_lesson_id) or public.is_admin()) then return null; end if;
  select md5(coalesce(l.key_terms, '') || E'\n' || coalesce((select string_agg(s ->> 'text', E'\n' order by ord) from jsonb_array_elements(l.steps) with ordinality as x(s, ord)), ''))
    into v from learning_lessons l where l.id = p_lesson_id;
  return v;
end;
$$;

-- ---- tables -----------------------------------------------------------------------------------------------------------------

create table public.learning_lesson_guides (
  lesson_id uuid primary key references public.learning_lessons(id) on delete cascade,
  key_points jsonb not null default '[]'::jsonb,
  can_do jsonb not null default '[]'::jsonb,
  cards jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'on')),
  drafted_by_ai boolean not null default false,
  generated_at timestamptz,
  source_hash text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.trg_learning_lesson_guides_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.lesson_id <> old.lesson_id then
    raise exception 'A guide cannot move to another lesson.' using errcode = 'P0001';
  end if;
  if not public.learning_guide_valid(new.key_points, new.can_do, new.cards) then
    raise exception 'The study guide is not valid. Check the lengths and remove any web addresses.' using errcode = 'P0001';
  end if;
  if new.status = 'on'
     and jsonb_array_length(new.key_points) = 0 and jsonb_array_length(new.can_do) = 0 and jsonb_array_length(new.cards) = 0 then
    raise exception 'Add something to the guide before switching it on.' using errcode = 'P0001';
  end if;
  -- Saving or switching on counts as the teacher checking the guide against the lesson as it is now.
  new.source_hash := public.learning_lesson_text_hash(new.lesson_id);
  if new.status = 'on' then
    if tg_op = 'INSERT' or old.status <> 'on' then new.approved_at := now(); end if;
  else
    new.approved_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger learning_lesson_guides_guard before insert or update on public.learning_lesson_guides
  for each row execute function public.trg_learning_lesson_guides_guard();

create table public.learning_guide_reports (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('key_point', 'can_do', 'card')),
  item_index int not null check (item_index between 0 and 29),
  note text not null default '' check (length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (lesson_id, student_id, kind, item_index)
);
create index learning_guide_reports_lesson_idx on public.learning_guide_reports (lesson_id, created_at desc);

-- ---- permissions -------------------------------------------------------------------------------------------------------------

alter table public.learning_lesson_guides enable row level security;
alter table public.learning_guide_reports enable row level security;

create policy "Owners manage their lesson guides" on public.learning_lesson_guides
  for all using (public.learning_owns_lesson(lesson_id))
  with check (public.learning_owns_lesson(lesson_id));
create policy "School admins view lesson guides" on public.learning_lesson_guides
  for select using (public.is_admin());
-- Students have no policy on guides: they use learning_get_guide() below.

create policy "Owners view reports on their lessons" on public.learning_guide_reports
  for select using (public.learning_owns_lesson(lesson_id) or public.is_admin());
-- Reports are written only by learning_report_guide_item().
revoke insert, update, delete, truncate on public.learning_guide_reports from anon, authenticated;

-- ---- what a student sees and does --------------------------------------------------------------------------------------------

-- The guide for a lesson the student can open, once the teacher has switched it on. Nothing (null) when there is no guide, it is
-- not on, or the lesson is not open to them: the lesson screen already explains why a lesson is unavailable.
create or replace function public.learning_get_guide(p_lesson_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_access text;
  g learning_lesson_guides;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  v_access := public.learning_student_access(p_lesson_id);
  if v_access <> 'open' then return null; end if;
  select * into g from learning_lesson_guides where lesson_id = p_lesson_id and status = 'on';
  if not found then return null; end if;
  return jsonb_build_object('key_points', g.key_points, 'can_do', g.can_do, 'cards', g.cards);
end;
$$;

-- A student marks one item as looking wrong. One report per item per student; up to 10 per lesson.
create or replace function public.learning_report_guide_item(p_lesson_id uuid, p_kind text, p_index int, p_note text default '')
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if public.learning_student_access(p_lesson_id) <> 'open' then raise exception 'This lesson is not available to you.' using errcode = '42501'; end if;
  if not exists (select 1 from learning_lesson_guides where lesson_id = p_lesson_id and status = 'on') then
    raise exception 'There is no study guide for this lesson.' using errcode = 'P0001';
  end if;
  if p_kind not in ('key_point', 'can_do', 'card') or p_index is null or p_index < 0 or p_index > 29 then
    raise exception 'Unknown item.' using errcode = 'P0001';
  end if;
  if (select count(*) from learning_guide_reports where lesson_id = p_lesson_id and student_id = auth.uid()) >= 10 then
    raise exception 'You have already told your teacher about several items. Thank you.' using errcode = 'P0001';
  end if;
  insert into learning_guide_reports (lesson_id, student_id, kind, item_index, note)
  values (p_lesson_id, auth.uid(), p_kind, p_index, left(coalesce(p_note, ''), 300))
  on conflict (lesson_id, student_id, kind, item_index) do nothing;
end;
$$;

-- ---- what the teacher sees ----------------------------------------------------------------------------------------------------

-- Is the lesson's text different from when the guide was last checked?
create or replace function public.learning_guide_stale(p_lesson_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare g learning_lesson_guides;
begin
  if not (public.learning_owns_lesson(p_lesson_id) or public.is_admin()) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select * into g from learning_lesson_guides where lesson_id = p_lesson_id;
  if not found then return false; end if;
  return g.source_hash is distinct from public.learning_lesson_text_hash(p_lesson_id);
end;
$$;

-- How many students flagged each item, for the teacher's guide tab.
create or replace function public.learning_guide_report_counts(p_lesson_id uuid)
returns table (kind text, item_index int, reports int, last_at timestamptz)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not (public.learning_owns_lesson(p_lesson_id) or public.is_admin()) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select r.kind, r.item_index, count(*)::int, max(r.created_at)
    from learning_guide_reports r where r.lesson_id = p_lesson_id
   group by r.kind, r.item_index
   order by max(r.created_at) desc;
end;
$$;

-- The teacher clears the reports on a lesson after fixing the guide.
create or replace function public.learning_guide_clear_reports(p_lesson_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.learning_owns_lesson(p_lesson_id) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  delete from learning_guide_reports where lesson_id = p_lesson_id;
end;
$$;

-- Tiny probe so the app can hide the guide features until this migration is installed.
create or replace function public.learning_guides_ready()
returns boolean language sql stable as $$ select true $$;

revoke execute on function
  public.learning_lesson_text_hash(uuid), public.learning_get_guide(uuid), public.learning_report_guide_item(uuid, text, int, text),
  public.learning_guide_stale(uuid), public.learning_guide_report_counts(uuid), public.learning_guide_clear_reports(uuid),
  public.learning_guides_ready()
from public, anon;
grant execute on function
  public.learning_lesson_text_hash(uuid), public.learning_get_guide(uuid), public.learning_report_guide_item(uuid, text, int, text),
  public.learning_guide_stale(uuid), public.learning_guide_report_counts(uuid), public.learning_guide_clear_reports(uuid),
  public.learning_guides_ready()
to authenticated;

commit;

select 'Migration 100 applied' as result;
