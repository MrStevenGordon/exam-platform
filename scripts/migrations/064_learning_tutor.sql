-- Smart Learning AI tutor: saved conversations between a student and the tutor about one lesson.
--
-- WHAT IS STORED
--   One conversation per student per lesson, and its messages. The tutor's replies are written by
--   the server after it has checked the student may open that lesson. Nothing here calls an AI:
--   this is only the record.
--
-- TRANSPARENCY AND SAFETY
--   * The student can read their own conversation. They cannot edit or delete it (an adult
--     reviewing a worrying message must be able to rely on the record being complete). Students
--     are told on screen that their teacher can read it.
--   * The lesson's teacher, school admins and the principal team can read it.
--   * A conversation can be FLAGGED (wellbeing or inappropriate) by the server, and stays
--     "to review" until an adult marks it reviewed.
--   * Nobody can write these tables from a browser. Only the server (with the service key) adds
--     messages, and only the functions below let a reviewer mark a conversation reviewed.
--   * Deleting a lesson or a student deletes their conversations. learning_tutor_purge() removes
--     old conversations; the school decides how long to keep them.
--
-- Requires 055 (principal role) and 059 (Smart Learning).
-- Roll back with scripts/migrations/rollback/064_learning_tutor_rollback.sql

begin;

create table public.learning_tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  flagged boolean not null default false,
  flag_reason text check (flag_reason in ('wellbeing', 'inappropriate')),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  unique (lesson_id, student_id),
  check (flag_reason is null or flagged)
);
create index learning_tutor_conversations_student_idx on public.learning_tutor_conversations (student_id);
create index learning_tutor_conversations_flag_idx on public.learning_tutor_conversations (lesson_id) where flagged and reviewed_at is null;
create index learning_tutor_conversations_recent_idx on public.learning_tutor_conversations (last_message_at);

create table public.learning_tutor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.learning_tutor_conversations(id) on delete cascade,
  role text not null check (role in ('student', 'tutor')),
  content text not null check (length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index learning_tutor_messages_conv_idx on public.learning_tutor_messages (conversation_id, created_at);

-- ---- who may read ------------------------------------------------------------------------------------

-- The lesson's teacher, a school admin or the principal team.
create or replace function public.learning_tutor_can_review(p_lesson_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select public.learning_owns_lesson(p_lesson_id) or public.is_admin() or public.is_principal() $$;

create or replace function public.learning_tutor_can_read(p_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from learning_tutor_conversations c
     where c.id = p_conversation_id
       and (c.student_id = auth.uid() or public.learning_tutor_can_review(c.lesson_id))
  )
$$;

alter table public.learning_tutor_conversations enable row level security;
alter table public.learning_tutor_messages enable row level security;

create policy "Students read their own tutor conversations" on public.learning_tutor_conversations
  for select using (student_id = auth.uid());
create policy "Reviewers read tutor conversations on their lessons" on public.learning_tutor_conversations
  for select using (public.learning_tutor_can_review(lesson_id));
create policy "Read messages of conversations you may read" on public.learning_tutor_messages
  for select using (public.learning_tutor_can_read(conversation_id));

revoke insert, update, delete, truncate on public.learning_tutor_conversations from anon, authenticated;
revoke insert, update, delete, truncate on public.learning_tutor_messages from anon, authenticated;

-- ---- what a reviewer sees ------------------------------------------------------------------------------

create or replace function public.learning_tutor_conversations(p_lesson_id uuid)
returns table (
  conversation_id uuid, student_id uuid, student_name text, student_code text, class_name text,
  student_messages int, last_message_at timestamptz, flagged boolean, flag_reason text, reviewed_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.learning_tutor_can_review(p_lesson_id) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select c.id, c.student_id, st.full_name, st.student_id, cls.name,
         (select count(*)::int from learning_tutor_messages m where m.conversation_id = c.id and m.role = 'student'),
         c.last_message_at, c.flagged, c.flag_reason, c.reviewed_at
    from learning_tutor_conversations c
    join profiles st on st.id = c.student_id
    left join lateral (
      select cg.name from learning_assignments a
        join class_groups cg on cg.id = a.class_group_id
        join enrollments e on e.class_group_id = a.class_group_id and e.student_id = c.student_id
       where a.lesson_id = c.lesson_id order by cg.name limit 1
    ) cls on true
   where c.lesson_id = p_lesson_id
   order by (c.flagged and c.reviewed_at is null) desc, c.last_message_at desc;
end;
$$;

create or replace function public.learning_tutor_transcript(p_conversation_id uuid)
returns table (role text, content text, created_at timestamptz)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_lesson uuid;
begin
  select lesson_id into v_lesson from learning_tutor_conversations where id = p_conversation_id;
  if v_lesson is null or not public.learning_tutor_can_review(v_lesson) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query select m.role, m.content, m.created_at from learning_tutor_messages m where m.conversation_id = p_conversation_id order by m.created_at, m.id;
end;
$$;

-- An adult confirms they have read a flagged conversation.
create or replace function public.learning_tutor_mark_reviewed(p_conversation_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_lesson uuid;
begin
  select lesson_id into v_lesson from learning_tutor_conversations where id = p_conversation_id;
  if v_lesson is null or not public.learning_tutor_can_review(v_lesson) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  update learning_tutor_conversations set reviewed_at = now(), reviewed_by = auth.uid() where id = p_conversation_id and flagged and reviewed_at is null;
end;
$$;

-- For a teacher's lesson list: how many flagged conversations on each lesson still need a look.
-- A teacher sees their own lessons; a school admin or principal sees every lesson.
create or replace function public.learning_tutor_flag_counts()
returns table (lesson_id uuid, to_review int)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.is_staff() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select c.lesson_id, count(*)::int
    from learning_tutor_conversations c
   where c.flagged and c.reviewed_at is null and public.learning_tutor_can_review(c.lesson_id)
   group by c.lesson_id;
end;
$$;

-- Removes conversations with no activity for p_days days. Server use only: how long to keep
-- them is the school's decision, and this is not callable from a browser.
create or replace function public.learning_tutor_purge(p_days int)
returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  n int;
begin
  if p_days is null or p_days < 1 then raise exception 'Choose a number of days of 1 or more.' using errcode = 'P0001'; end if;
  delete from learning_tutor_conversations where last_message_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.learning_tutor_purge(int) from public, anon, authenticated;
grant execute on function public.learning_tutor_purge(int) to service_role;

-- These two only answer "may the person asking do this?", so they are safe to grant. They must be
-- callable by signed-in users because the read policies above run them as the person reading.
revoke execute on function public.learning_tutor_can_review(uuid), public.learning_tutor_can_read(uuid) from public, anon;
grant execute on function public.learning_tutor_can_review(uuid), public.learning_tutor_can_read(uuid) to authenticated;
revoke execute on function
  public.learning_tutor_conversations(uuid), public.learning_tutor_transcript(uuid),
  public.learning_tutor_mark_reviewed(uuid), public.learning_tutor_flag_counts()
from public, anon;
grant execute on function
  public.learning_tutor_conversations(uuid), public.learning_tutor_transcript(uuid),
  public.learning_tutor_mark_reviewed(uuid), public.learning_tutor_flag_counts()
to authenticated;

commit;
