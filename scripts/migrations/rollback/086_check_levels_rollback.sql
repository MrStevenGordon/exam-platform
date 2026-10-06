-- Rolls back 086_check_levels.sql: puts the three check functions and the question limit back exactly as migration 060 had them, and
-- removes the level columns.
-- WARNING: any questions written at the SUPPORT or STRETCH level are DELETED (they could not be shown without levels), and the level
-- recorded on attempts is lost. Attempts and scores themselves are kept. Core questions are untouched.
begin;

delete from public.learning_check_questions where level <> 'core';

drop function if exists public.check_levels_ready();
drop function if exists public.learning_resolve_check_level(uuid, text);
drop function if exists public.learning_get_check(uuid, text);
drop function if exists public.learning_submit_check(uuid, jsonb, text);
drop function if exists public.learning_check_results(uuid);

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

revoke execute on function public.learning_get_check(uuid), public.learning_submit_check(uuid, jsonb), public.learning_check_results(uuid) from public, anon;
grant execute on function public.learning_get_check(uuid), public.learning_submit_check(uuid, jsonb), public.learning_check_results(uuid) to authenticated;

alter table public.learning_check_questions drop column if exists level;
alter table public.learning_check_attempts drop column if exists level;

commit;
select 'Migration 086 rolled back' as result;
