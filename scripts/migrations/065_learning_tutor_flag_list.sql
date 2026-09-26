-- School-wide list of flagged AI tutor conversations, for the principal team and school admins.
--
-- A teacher already sees flagged conversations on their own lessons (migration 064). This adds the
-- view for the people responsible for safeguarding across the whole school: every flagged
-- conversation on every lesson, how long each has been waiting, and who has read it.
--
-- ALSO RECORDED: WHEN a conversation was flagged (flagged_at), so anything left unread can be seen
-- and chased. A trigger keeps it up to date, so the server code that raises flags does not change.
--   * first flag        -> flagged_at = now
--   * a second concern before anyone has read it -> flagged_at stays (it keeps its original wait)
--   * a new concern AFTER it was read -> the wait starts again
--   * flag removed      -> cleared
--
-- WHO: the principal team and school admins only. HODs and teachers are not included (teachers
-- keep the per-lesson Tutor tab). Transcripts and "mark as read" are the existing 064 functions,
-- which already allow these roles.
--
-- Requires 055 and 064.
-- Roll back with scripts/migrations/rollback/065_learning_tutor_flag_list_rollback.sql

begin;

alter table public.learning_tutor_conversations add column if not exists flagged_at timestamptz;
update public.learning_tutor_conversations set flagged_at = last_message_at where flagged and flagged_at is null;
create index if not exists learning_tutor_conversations_flagged_at_idx on public.learning_tutor_conversations (flagged_at) where flagged;

create or replace function public.trg_learning_tutor_flagged_at()
returns trigger
language plpgsql
as $$
begin
  if not new.flagged then
    new.flagged_at := null;
  elsif tg_op = 'INSERT' or not old.flagged or (old.reviewed_at is not null and new.reviewed_at is null) then
    new.flagged_at := now();
  else
    new.flagged_at := coalesce(old.flagged_at, new.flagged_at, now());
  end if;
  return new;
end;
$$;
drop trigger if exists learning_tutor_flagged_at on public.learning_tutor_conversations;
create trigger learning_tutor_flagged_at before insert or update on public.learning_tutor_conversations
  for each row execute function public.trg_learning_tutor_flagged_at();

create or replace function public.learning_tutor_oversight()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select public.is_admin() or public.is_principal() $$;
revoke execute on function public.learning_tutor_oversight() from public, anon;
grant execute on function public.learning_tutor_oversight() to authenticated;

-- Every conversation still to read (never limited), plus the 200 most recently flagged ones that have
-- already been read. No message text: a reader opens one to see the transcript.
create or replace function public.learning_tutor_flagged()
returns table (
  conversation_id uuid, lesson_id uuid, lesson_title text, lesson_subject text, teacher_name text,
  student_id uuid, student_name text, student_code text, class_name text,
  flag_reason text, flagged_at timestamptz, last_message_at timestamptz, student_messages int,
  reviewed_at timestamptz, reviewed_by_name text
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.learning_tutor_oversight() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  with f as (
    select c0.*, row_number() over (partition by (c0.reviewed_at is null) order by c0.flagged_at desc nulls last) as rn
      from learning_tutor_conversations c0
     where c0.flagged
  )
  select c.id, l.id, l.title, l.subject, t.full_name,
         st.id, st.full_name, st.student_id,
         (select min(cg.name) from enrollments e join class_groups cg on cg.id = e.class_group_id where e.student_id = st.id),
         c.flag_reason, c.flagged_at, c.last_message_at,
         (select count(*)::int from learning_tutor_messages m where m.conversation_id = c.id and m.role = 'student'),
         c.reviewed_at, rv.full_name
    from f c
    join learning_lessons l on l.id = c.lesson_id
    join profiles st on st.id = c.student_id
    left join profiles t on t.id = l.teacher_id
    left join profiles rv on rv.id = c.reviewed_by
   where c.reviewed_at is null or c.rn <= 200
   -- Unread first, wellbeing concerns before other flags, the longest-waiting at the top.
   -- Conversations already read follow, newest first.
   order by (c.reviewed_at is not null),
            case when c.reviewed_at is null then (c.flag_reason is distinct from 'wellbeing')::int else 0 end,
            case when c.reviewed_at is null then c.flagged_at end asc nulls last,
            c.flagged_at desc nulls last;
end;
$$;

-- The numbers for the page header and the menu badge.
create or replace function public.learning_tutor_flagged_counts()
returns table (open_total int, open_wellbeing int, open_inappropriate int, oldest_open_at timestamptz, read_last_30_days int)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.learning_tutor_oversight() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select (count(*) filter (where c.flagged and c.reviewed_at is null))::int,
         (count(*) filter (where c.flagged and c.reviewed_at is null and c.flag_reason = 'wellbeing'))::int,
         (count(*) filter (where c.flagged and c.reviewed_at is null and c.flag_reason = 'inappropriate'))::int,
         min(c.flagged_at) filter (where c.flagged and c.reviewed_at is null),
         (count(*) filter (where c.flagged and c.reviewed_at >= now() - interval '30 days'))::int
    from learning_tutor_conversations c;
end;
$$;

revoke execute on function public.learning_tutor_flagged(), public.learning_tutor_flagged_counts() from public, anon;
grant execute on function public.learning_tutor_flagged(), public.learning_tutor_flagged_counts() to authenticated;

commit;
