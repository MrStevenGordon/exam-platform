-- 086: three levels of practice on a lesson check (Smart Learning).
--
-- A teacher can write the check questions for a lesson at three levels: SUPPORT, CORE and STRETCH. The student does one level at
-- a time. The app suggests a level from how the student has done on that lesson's topic (their results by topic, migration 083),
-- and the student can always change it. The teacher sees which level each student did.
--
-- NOTHING CHANGES FOR EXISTING LESSONS. Every existing question becomes a CORE question, every existing attempt a CORE attempt. A
-- lesson with only core questions shows no level choice and marks exactly as before.
--
-- WHAT THIS CHANGES (three database functions are replaced with versions that take an optional level):
--   * learning_get_check(lesson, level default null)          the questions of one level (the core level when none is asked for),
--                                                             and which levels the lesson has
--   * learning_submit_check(lesson, answers, level default null)  marks only that level's questions and records the level on the attempt
--   * learning_check_results(lesson)                          adds the level of each student's first and latest attempt
-- The right answers still reach a student only after they submit. The first attempt is still the one recorded as evidence.
--
-- LIMITS: up to 10 questions per level (so up to 30 on a lesson); up to 20 attempts per student per lesson across all levels.
--
-- Needs 060. Roll back with scripts/migrations/rollback/086_check_levels_rollback.sql

begin;

do $$
begin
  if to_regclass('public.learning_check_questions') is null then
    raise exception 'Apply migration 060 (lesson check questions) first.';
  end if;
end $$;

alter table public.learning_check_questions
  add column if not exists level text not null default 'core' check (level in ('support', 'core', 'stretch'));
alter table public.learning_check_attempts
  add column if not exists level text not null default 'core' check (level in ('support', 'core', 'stretch'));

-- ---- the 10 question limit now applies to each level ------------------------------------------------------------------------

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

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.level <> old.level) then
    select count(*) into n from learning_check_questions where lesson_id = new.lesson_id and level = new.level;
    if n >= 10 then raise exception 'A lesson can have up to 10 check questions at each level.' using errcode = 'P0001'; end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ---- which level a student is given ------------------------------------------------------------------------------------------
-- The level asked for if the lesson has questions at it; otherwise core if it has any; otherwise the first level it does have.
create or replace function public.learning_resolve_check_level(p_lesson_id uuid, p_level text)
returns text
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select l from unnest(array[p_level]) l where p_level in ('support', 'core', 'stretch')
        and exists (select 1 from learning_check_questions q where q.lesson_id = p_lesson_id and q.level = l)),
    (select 'core' where exists (select 1 from learning_check_questions q where q.lesson_id = p_lesson_id and q.level = 'core')),
    (select l from unnest(array['support', 'core', 'stretch']) with ordinality t(l, o)
       where exists (select 1 from learning_check_questions q where q.lesson_id = p_lesson_id and q.level = t.l) order by o limit 1),
    'core')
$$;

-- ---- what a student sees and does ---------------------------------------------------------------------------------------------
drop function if exists public.learning_get_check(uuid);
drop function if exists public.learning_submit_check(uuid, jsonb);

-- The questions of one level, WITHOUT the right answers, the levels the lesson has, and how the student has done so far.
create or replace function public.learning_get_check(p_lesson_id uuid, p_level text default null)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_access text := public.learning_student_access(p_lesson_id);
  v_first learning_check_attempts;
  v_attempts int;
  v_best int;
  v_level text;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_access = 'none' then raise exception 'This lesson is not available to you.' using errcode = '42501'; end if;
  if v_access = 'closed' then raise exception 'This lesson closed after its due date.' using errcode = 'P0001'; end if;
  if p_level is not null and p_level not in ('support', 'core', 'stretch') then raise exception 'That level is not available.' using errcode = 'P0001'; end if;

  v_level := public.learning_resolve_check_level(p_lesson_id, p_level);
  select * into v_first from learning_check_attempts where lesson_id = p_lesson_id and student_id = auth.uid() and attempt_no = 1;
  select count(*), max(score) into v_attempts, v_best from learning_check_attempts where lesson_id = p_lesson_id and student_id = auth.uid();

  return jsonb_build_object(
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'prompt', q.prompt, 'options', q.options) order by q.position, q.created_at)
        from learning_check_questions q where q.lesson_id = p_lesson_id and q.level = v_level), '[]'::jsonb),
    'level', v_level,
    'levels', coalesce((select jsonb_agg(t.l order by t.o)
                          from unnest(array['support', 'core', 'stretch']) with ordinality t(l, o)
                         where exists (select 1 from learning_check_questions q where q.lesson_id = p_lesson_id and q.level = t.l)), '[]'::jsonb),
    'attempts', v_attempts,
    'first_try_score', v_first.score,
    'first_try_max', v_first.max_score,
    'best_score', v_best
  );
end;
$$;

-- Marks one level of a check. Shows the right answers and explanations only now, after the student has answered. The first
-- attempt is recorded as evidence; later attempts are practice.
create or replace function public.learning_submit_check(p_lesson_id uuid, p_answers jsonb, p_level text default null)
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
  v_level text;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_access = 'none' then raise exception 'This lesson is not available to you.' using errcode = '42501'; end if;
  if v_access = 'closed' then raise exception 'This lesson closed after its due date.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' or length(p_answers::text) > 20000 then
    raise exception 'Those answers could not be read.' using errcode = 'P0001';
  end if;
  if p_level is not null and p_level not in ('support', 'core', 'stretch') then raise exception 'That level is not available.' using errcode = 'P0001'; end if;

  select * into l from learning_lessons where id = p_lesson_id;
  v_level := public.learning_resolve_check_level(p_lesson_id, p_level);

  -- One submit at a time per student and lesson, so attempt numbers never collide.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_lesson_id::text, 0));

  select coalesce(max(attempt_no), 0) + 1 into v_attempt from learning_check_attempts where lesson_id = p_lesson_id and student_id = auth.uid();
  if v_attempt > 20 then raise exception 'You have used all your attempts on this check.' using errcode = 'P0001'; end if;

  for q in select * from learning_check_questions where lesson_id = p_lesson_id and level = v_level order by position, created_at loop
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

  insert into learning_check_attempts (lesson_id, student_id, attempt_no, answers, results, score, max_score, level)
  values (p_lesson_id, auth.uid(), v_attempt, p_answers, v_results, v_score, v_max, v_level);

  -- Only the first try is evidence. Recording it must never stop the student's result from counting.
  if v_attempt = 1 then
    begin
      perform public.record_evidence(auth.uid(), 'learning_check', p_lesson_id, l.topic_id, l.subject, l.grade, v_score, v_max,
                                     jsonb_build_object('kind', 'check', 'questions', v_max, 'level', v_level));
    exception when others then
      raise warning 'Evidence was not recorded for lesson %: %', p_lesson_id, sqlerrm;
    end;
  end if;

  return jsonb_build_object('attempt_no', v_attempt, 'first_try', v_attempt = 1, 'score', v_score, 'max', v_max, 'level', v_level, 'results', v_show);
end;
$$;

-- ---- what the teacher sees ----------------------------------------------------------------------------------------------------
drop function if exists public.learning_check_results(uuid);

-- Every student in every class the lesson is assigned to: first-try score, best score, attempts, and which level they did.
create or replace function public.learning_check_results(p_lesson_id uuid)
returns table (
  student_id uuid, student_name text, student_code text, class_group_id uuid, class_name text,
  attempts int, first_score int, first_max int, best_score int, last_at timestamptz,
  first_level text, last_level text
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
         (select max(a.submitted_at) from learning_check_attempts a where a.lesson_id = p_lesson_id and a.student_id = st.id),
         (select a.level from learning_check_attempts a where a.lesson_id = p_lesson_id and a.student_id = st.id and a.attempt_no = 1),
         (select a.level from learning_check_attempts a where a.lesson_id = p_lesson_id and a.student_id = st.id order by a.attempt_no desc limit 1)
  from learning_assignments asg
  join class_groups cg on cg.id = asg.class_group_id
  join enrollments e on e.class_group_id = asg.class_group_id
  join profiles st on st.id = e.student_id
  where asg.lesson_id = p_lesson_id
  order by cg.name, st.full_name;
end;
$$;

revoke execute on function public.learning_get_check(uuid, text), public.learning_submit_check(uuid, jsonb, text), public.learning_check_results(uuid),
  public.learning_resolve_check_level(uuid, text) from public, anon;
grant execute on function public.learning_get_check(uuid, text), public.learning_submit_check(uuid, jsonb, text), public.learning_check_results(uuid),
  public.learning_resolve_check_level(uuid, text) to authenticated;

-- Tiny probe so the app can hide the level choices until this migration is installed.
create or replace function public.check_levels_ready()
returns boolean language sql immutable as $$ select true $$;
grant execute on function public.check_levels_ready() to authenticated;

commit;
select 'Migration 086 applied' as result;
