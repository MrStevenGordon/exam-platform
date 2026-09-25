-- Smart Learning check questions, and the shared evidence feed.
--
-- SHAPE
--   student_evidence          SHARED FOUNDATION. An append-only record of things a student has
--                             shown they can do: "scored 4 of 5 on Simple interest, first try".
--                             Any product can add to it through record_evidence(), and any
--                             product can read it. It is the one place the products meet.
--   learning_check_questions  Smart Learning's own short questions on a lesson (multiple choice
--                             or a number). Teacher-written. Students never read this table.
--   learning_check_attempts   Each time a student submits a check. Only the FIRST attempt counts
--                             as evidence; later ones are practice.
--
-- WHY CHECK QUESTIONS ARE THEIR OWN, NOT THE EXAM QUESTION BANK
--   Questions in the bank belong to exams, and some of them are live exam questions. If Learning
--   read them, a student could see an exam question before the exam. Learning therefore has its
--   own questions, written for the lesson. Nothing here reads or writes anything in Smart Assess.
--
-- ISOLATION
--   Nothing here can slow down or block exam taking. A failure to record evidence never stops a
--   student from submitting a check (it is logged as a warning and the check still counts).
--
-- SECURITY
--   * Students have NO access to the question or attempt-writing tables. They use the functions
--     below, which check the lesson is published, given to their class and not closed. The right
--     answers leave the database only after a student has submitted.
--   * Nobody can write evidence directly. record_evidence() is callable only from inside other
--     trusted functions (it is not granted to signed-in users), so a student cannot give
--     themselves a score. Evidence rows cannot be edited; they are removed only when the student
--     is deleted.
--
-- Requires 058 (topics) and 059 (Smart Learning).
-- Roll back with scripts/migrations/rollback/060_learning_checks_and_evidence_rollback.sql
-- (this deletes all check questions, attempts and evidence).

begin;

-- =====================================================================================
-- Shared evidence feed
-- =====================================================================================

create table public.student_evidence (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  -- Which product recorded it, e.g. 'learning_check'. New products add new values without a migration.
  source text not null check (source ~ '^[a-z][a-z0-9_]{1,39}$'),
  -- The thing it came from (a lesson, an exam, a game), for reference only.
  source_ref uuid,
  topic_id uuid references public.curriculum_topics(id) on delete set null,
  subject text,
  grade int check (grade between 7 and 13),
  score numeric not null check (score >= 0),
  max_score numeric not null check (max_score > 0),
  detail jsonb not null default '{}'::jsonb check (length(detail::text) <= 4000),
  check (score <= max_score)
);
create index student_evidence_student_idx on public.student_evidence (student_id, occurred_at desc);
create index student_evidence_topic_idx on public.student_evidence (topic_id) where topic_id is not null;

create or replace function public.trg_student_evidence_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Evidence cannot be changed once recorded.' using errcode = 'P0001';
end;
$$;
create trigger student_evidence_no_update before update on public.student_evidence
  for each row execute function public.trg_student_evidence_append_only();

alter table public.student_evidence enable row level security;

-- Who may read a student's evidence: the student, their teachers, their HOD, the school admin
-- and the principal team. Nobody gets a write policy.
create policy "Read evidence you are entitled to" on public.student_evidence
  for select using (
    student_id = auth.uid()
    or public.is_admin()
    or public.is_principal()
    or public.is_teacher_of_class_student(student_id)
    or public.is_supervisor_of_student(student_id)
  );

revoke insert, update, delete, truncate on public.student_evidence from anon, authenticated;

-- The only way in. Not granted to signed-in users: other trusted functions call it.
create or replace function public.record_evidence(
  p_student_id uuid, p_source text, p_source_ref uuid, p_topic_id uuid, p_subject text,
  p_grade int, p_score numeric, p_max_score numeric, p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into student_evidence (student_id, source, source_ref, topic_id, subject, grade, score, max_score, detail)
  values (p_student_id, p_source, p_source_ref, p_topic_id, nullif(btrim(p_subject), ''), p_grade, p_score, p_max_score, coalesce(p_detail, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.record_evidence(uuid, text, uuid, uuid, text, int, numeric, numeric, jsonb) from public, anon, authenticated;

-- A student's strengths and gaps by topic. A student sees their own; a teacher, HOD, the
-- school admin or principal sees the students they are entitled to.
create or replace function public.evidence_topic_summary(p_student_id uuid default null)
returns table (
  topic_id uuid, topic_name text, subject text, grade int,
  evidence_count int, score_sum numeric, max_sum numeric, last_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_student uuid := coalesce(p_student_id, auth.uid());
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_student <> auth.uid()
     and not (public.is_admin() or public.is_principal()
              or public.is_teacher_of_class_student(v_student) or public.is_supervisor_of_student(v_student)) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
  -- Evidence tagged with a topic that was later merged into another counts toward the topic it became.
  select t.id, t.name, t.subject, t.grade, count(*)::int, sum(e.score), sum(e.max_score), max(e.occurred_at)
  from student_evidence e
  join curriculum_topics t on t.id = coalesce((select m.merged_into from curriculum_topics m where m.id = e.topic_id), e.topic_id)
  where e.student_id = v_student and e.topic_id is not null and t.status <> 'archived'
  group by t.id, t.name, t.subject, t.grade
  order by max(e.occurred_at) desc;
end;
$$;

-- =====================================================================================
-- Smart Learning check questions
-- =====================================================================================

create table public.learning_check_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  position int not null default 1 check (position between 1 and 50),
  kind text not null check (kind in ('multiple_choice', 'numeric')),
  prompt text not null check (btrim(prompt) <> '' and length(prompt) <= 2000),
  options jsonb,            -- multiple choice: 2 to 6 answers
  correct_index int,        -- multiple choice: which answer is right (0 = the first)
  correct_number numeric,   -- numeric: the right answer
  tolerance numeric not null default 0 check (tolerance >= 0),
  explanation text not null default '' check (length(explanation) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index learning_check_questions_lesson_idx on public.learning_check_questions (lesson_id, position, created_at);

create or replace function public.trg_learning_check_questions_guard()
returns trigger
language plpgsql
as $$
declare
  i int;
  n int;
begin
  if tg_op = 'UPDATE' and new.lesson_id <> old.lesson_id then
    raise exception 'A question cannot move to another lesson.' using errcode = 'P0001';
  end if;

  if new.kind = 'multiple_choice' then
    if jsonb_typeof(new.options) is distinct from 'array' or jsonb_array_length(new.options) not between 2 and 6 then
      raise exception 'A multiple choice question needs 2 to 6 answers.' using errcode = 'P0001';
    end if;
    for i in 0 .. jsonb_array_length(new.options) - 1 loop
      if jsonb_typeof(new.options -> i) is distinct from 'string'
         or btrim(new.options ->> i) = '' or length(new.options ->> i) > 300 then
        raise exception 'Every answer needs some text (up to 300 characters).' using errcode = 'P0001';
      end if;
    end loop;
    if new.correct_index is null or new.correct_index < 0 or new.correct_index >= jsonb_array_length(new.options) then
      raise exception 'Choose which answer is correct.' using errcode = 'P0001';
    end if;
    new.correct_number := null;
    new.tolerance := 0;
  else
    if new.correct_number is null or abs(new.correct_number) >= 1e12 then
      raise exception 'A number question needs a correct answer.' using errcode = 'P0001';
    end if;
    if new.tolerance >= 1e12 then raise exception 'That tolerance is too large.' using errcode = 'P0001'; end if;
    new.options := null;
    new.correct_index := null;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into n from learning_check_questions where lesson_id = new.lesson_id;
    if n >= 10 then raise exception 'A lesson can have up to 10 check questions.' using errcode = 'P0001'; end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
create trigger learning_check_questions_guard before insert or update on public.learning_check_questions
  for each row execute function public.trg_learning_check_questions_guard();

create table public.learning_check_attempts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_no int not null check (attempt_no >= 1),
  answers jsonb not null default '{}'::jsonb check (length(answers::text) <= 20000),
  -- [{question_id, correct}] as marked at the time, so later edits to a question never rewrite history
  results jsonb not null default '[]'::jsonb,
  score int not null check (score >= 0),
  max_score int not null check (max_score > 0),
  submitted_at timestamptz not null default now(),
  unique (lesson_id, student_id, attempt_no)
);
create index learning_check_attempts_student_idx on public.learning_check_attempts (student_id, submitted_at desc);

alter table public.learning_check_questions enable row level security;
alter table public.learning_check_attempts enable row level security;

create policy "Owners manage their check questions" on public.learning_check_questions
  for all using (public.learning_owns_lesson(lesson_id))
  with check (public.learning_owns_lesson(lesson_id));
create policy "School admins view check questions" on public.learning_check_questions
  for select using (public.is_admin());
-- Students get no policy on the questions: they use learning_get_check() below.

create policy "Owners view attempts on their lessons" on public.learning_check_attempts
  for select using (public.learning_owns_lesson(lesson_id) or public.is_admin());
create policy "Students view their own attempts" on public.learning_check_attempts
  for select using (student_id = auth.uid());
-- Attempts are written only by learning_submit_check().
revoke insert, update, delete, truncate on public.learning_check_attempts from anon, authenticated;

-- ---- what a student sees and does ---------------------------------------------------------

-- The questions, WITHOUT the right answers, and how the student has done so far.
create or replace function public.learning_get_check(p_lesson_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_access text := public.learning_student_access(p_lesson_id);
  v_first learning_check_attempts;
  v_attempts int;
  v_best int;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_access = 'none' then raise exception 'This lesson is not available to you.' using errcode = '42501'; end if;
  if v_access = 'closed' then raise exception 'This lesson closed after its due date.' using errcode = 'P0001'; end if;

  select * into v_first from learning_check_attempts where lesson_id = p_lesson_id and student_id = auth.uid() and attempt_no = 1;
  select count(*), max(score) into v_attempts, v_best from learning_check_attempts where lesson_id = p_lesson_id and student_id = auth.uid();

  return jsonb_build_object(
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'prompt', q.prompt, 'options', q.options) order by q.position, q.created_at)
        from learning_check_questions q where q.lesson_id = p_lesson_id), '[]'::jsonb),
    'attempts', v_attempts,
    'first_try_score', v_first.score,
    'first_try_max', v_first.max_score,
    'best_score', v_best
  );
end;
$$;

-- Marks a check. Shows the right answers and explanations only now, after the student has
-- answered. The first attempt is recorded as evidence; later attempts are practice.
create or replace function public.learning_submit_check(p_lesson_id uuid, p_answers jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_access text := public.learning_student_access(p_lesson_id);
  l learning_lessons;
  q learning_check_questions;
  v_raw text;
  v_num numeric;
  v_ok boolean;
  v_score int := 0;
  v_max int := 0;
  v_attempt int;
  v_results jsonb := '[]'::jsonb;
  v_show jsonb := '[]'::jsonb;
  v_answer text;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_access = 'none' then raise exception 'This lesson is not available to you.' using errcode = '42501'; end if;
  if v_access = 'closed' then raise exception 'This lesson closed after its due date.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' or length(p_answers::text) > 20000 then
    raise exception 'Those answers could not be read.' using errcode = 'P0001';
  end if;

  select * into l from learning_lessons where id = p_lesson_id;

  -- One submit at a time per student and lesson, so attempt numbers never collide.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_lesson_id::text, 0));

  select coalesce(max(attempt_no), 0) + 1 into v_attempt from learning_check_attempts where lesson_id = p_lesson_id and student_id = auth.uid();
  if v_attempt > 20 then raise exception 'You have used all your attempts on this check.' using errcode = 'P0001'; end if;

  for q in select * from learning_check_questions where lesson_id = p_lesson_id order by position, created_at loop
    v_max := v_max + 1;
    v_raw := p_answers ->> q.id::text;
    v_ok := false;

    if q.kind = 'multiple_choice' then
      v_ok := v_raw ~ '^[0-9]{1,2}$' and v_raw::int = q.correct_index;
      v_answer := q.options ->> q.correct_index;
    else
      -- Spaces and thousands commas are ignored: "1 250" and "1,250" both read as 1250.
      v_raw := regexp_replace(coalesce(v_raw, ''), '[\s,]', '', 'g');
      if v_raw ~ '^-?([0-9]{1,15}(\.[0-9]{0,10})?|\.[0-9]{1,10})$' then
        v_num := v_raw::numeric;
        v_ok := abs(v_num - q.correct_number) <= q.tolerance + 0.000000001;
      end if;
      -- Show 1.50 as 1.5 and 100.00 as 100, but never strip the zeros from a whole number like 100.
      v_answer := q.correct_number::text;
      if position('.' in v_answer) > 0 then v_answer := rtrim(rtrim(v_answer, '0'), '.'); end if;
    end if;

    if v_ok then v_score := v_score + 1; end if;
    v_results := v_results || jsonb_build_object('question_id', q.id, 'correct', v_ok);
    v_show := v_show || jsonb_build_object('question_id', q.id, 'correct', v_ok, 'correct_answer', v_answer, 'explanation', q.explanation);
  end loop;

  if v_max = 0 then raise exception 'This lesson has no check questions.' using errcode = 'P0001'; end if;

  insert into learning_check_attempts (lesson_id, student_id, attempt_no, answers, results, score, max_score)
  values (p_lesson_id, auth.uid(), v_attempt, p_answers, v_results, v_score, v_max);

  -- Only the first try is evidence. Recording it must never stop the student's result from counting.
  if v_attempt = 1 then
    begin
      perform public.record_evidence(auth.uid(), 'learning_check', p_lesson_id, l.topic_id, l.subject, l.grade, v_score, v_max,
                                     jsonb_build_object('kind', 'check', 'questions', v_max));
    exception when others then
      raise warning 'Evidence was not recorded for lesson %: %', p_lesson_id, sqlerrm;
    end;
  end if;

  return jsonb_build_object('attempt_no', v_attempt, 'first_try', v_attempt = 1, 'score', v_score, 'max', v_max, 'results', v_show);
end;
$$;

-- ---- what the teacher sees ----------------------------------------------------------------

-- Every student in every class the lesson is assigned to: first-try score, best score, attempts.
create or replace function public.learning_check_results(p_lesson_id uuid)
returns table (
  student_id uuid, student_name text, student_code text, class_group_id uuid, class_name text,
  attempts int, first_score int, first_max int, best_score int, last_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not (public.learning_owns_lesson(p_lesson_id) or public.is_admin()) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select st.id, st.full_name, st.student_id, cg.id, cg.name,
         coalesce((select count(*)::int from learning_check_attempts a where a.lesson_id = p_lesson_id and a.student_id = st.id), 0),
         (select a.score from learning_check_attempts a where a.lesson_id = p_lesson_id and a.student_id = st.id and a.attempt_no = 1),
         (select a.max_score from learning_check_attempts a where a.lesson_id = p_lesson_id and a.student_id = st.id and a.attempt_no = 1),
         (select max(a.score)::int from learning_check_attempts a where a.lesson_id = p_lesson_id and a.student_id = st.id),
         (select max(a.submitted_at) from learning_check_attempts a where a.lesson_id = p_lesson_id and a.student_id = st.id)
  from learning_assignments asg
  join class_groups cg on cg.id = asg.class_group_id
  join enrollments e on e.class_group_id = asg.class_group_id
  join profiles st on st.id = e.student_id
  where asg.lesson_id = p_lesson_id
  order by cg.name, st.full_name;
end;
$$;

-- Which questions the class found hard, judged on first tries only.
create or replace function public.learning_check_item_stats(p_lesson_id uuid)
returns table (question_id uuid, question_position int, prompt text, answered int, correct int)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not (public.learning_owns_lesson(p_lesson_id) or public.is_admin()) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select q.id, q.position, q.prompt,
         count(r.*)::int,
         (count(*) filter (where (r.item ->> 'correct')::boolean))::int
  from learning_check_questions q
  left join lateral (
    select jsonb_array_elements(a.results) as item
    from learning_check_attempts a
    where a.lesson_id = p_lesson_id and a.attempt_no = 1
  ) r on (r.item ->> 'question_id')::uuid = q.id
  where q.lesson_id = p_lesson_id
  group by q.id, q.position, q.prompt, q.created_at
  order by q.position, q.created_at;
end;
$$;

revoke execute on function
  public.learning_get_check(uuid), public.learning_submit_check(uuid, jsonb),
  public.learning_check_results(uuid), public.learning_check_item_stats(uuid), public.evidence_topic_summary(uuid)
from public, anon;
grant execute on function
  public.learning_get_check(uuid), public.learning_submit_check(uuid, jsonb),
  public.learning_check_results(uuid), public.learning_check_item_stats(uuid), public.evidence_topic_summary(uuid)
to authenticated;

commit;
