-- Tests for migration 081 (marking points on essay questions), on a throwaway database after
-- scripts/migrations/081_essay_rubric.sql and scripts/tests/exam-insight/seed.sql. Prints PASS or FAIL per check.
-- The one that matters most: giving an essay marking points must NOT change how an exam is marked when a student submits.
create temp table results (name text, ok boolean, detail text);
create or replace function check_that(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;

-- start clean (repeatable)
update questions set essay_rubric = null where id = u(504);
delete from responses where session_id in (u(691), u(692));
delete from exam_sessions where id in (u(691), u(692));

-- ============ the column ============
do $$
declare ok boolean;
begin
  update questions set essay_rubric = '[{"text":"Simple interest is on the original amount","marks":2},{"text":"Compound interest includes earlier interest","marks":2}]' where id = u(504);
  perform check_that('Essay may have marking points', (select essay_rubric -> 0 ->> 'text' from questions where id = u(504)) = 'Simple interest is on the original amount');

  begin update questions set essay_rubric = '[{"text":"x","marks":1}]' where id = u(501); ok := false; exception when check_violation then ok := true; end;
  perform check_that('A multiple choice question cannot have essay marking points', ok);
  begin update questions set essay_rubric = '[]' where id = u(504); ok := false; exception when check_violation then ok := true; end;
  perform check_that('An empty list is refused (use null for none)', ok);
  begin update questions set essay_rubric = '{"a":1}' where id = u(504); ok := false; exception when check_violation then ok := true; end;
  perform check_that('A non-list is refused', ok);
  begin
    update questions set essay_rubric = (select jsonb_agg(jsonb_build_object('text','p'||g,'marks',1)) from generate_series(1,13) g) where id = u(504); ok := false;
  exception when check_violation then ok := true; end;
  perform check_that('More than 12 points is refused', ok);
  begin update questions set question_type = 'short_answer' where id = u(504); ok := false; exception when check_violation then ok := true; end;
  perform check_that('Changing an essay with marking points to another type is refused until they are cleared', ok);
end $$;

-- ============ the scoring code does not read it ============
select check_that('score_answer ignores essay marking points (essay stays unmarked)', public.score_answer('essay', 4, null, null, 'any text') is null);
select check_that('Submit, scoring and student question functions never mention essay_rubric',
  (select count(*) from pg_proc where proname in ('student_submit_exam', 'score_answer', 'student_exam_questions', 'grade_multi_point') and prosrc ilike '%essay_rubric%') = 0);

-- ============ differential test: submit the same answers with and without essay marking points ============
create or replace function submit_as(p_uid uuid, p_session uuid, p_answers jsonb) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    r := public.student_submit_exam(p_session, p_answers, '{}'::jsonb, null, false);
  exception when others then reset role; return jsonb_build_object('error', sqlstate, 'message', sqlerrm);
  end;
  reset role;
  return r;
end $$;

-- Student 8 never started the class test; give two students (8 and 13 is inactive, so use 9 and 10 who are in another class but the exam only checks the session owner)
insert into exam_sessions (id, student_id, draft_exam_id, status, started_at, time_limit_seconds) values
  (u(691), u(108), u(401), 'in_progress', now(), 3600),
  (u(692), u(109), u(401), 'in_progress', now(), 3600);
do $$
declare
  answers jsonb := jsonb_build_object(u(501)::text, 'B', u(502)::text, 'C', u(503)::text, 'True', u(504)::text, 'Simple interest uses the original amount only; compound adds earlier interest.', u(505)::text, '1200');
  with_rubric jsonb; without_rubric jsonb;
begin
  -- WITH marking points on the essay
  update questions set essay_rubric = '[{"text":"Simple interest is on the original amount","marks":2},{"text":"Compound interest includes earlier interest","marks":2}]' where id = u(504);
  with_rubric := submit_as(u(108), u(691), answers);
  -- WITHOUT
  update questions set essay_rubric = null where id = u(504);
  without_rubric := submit_as(u(109), u(692), answers);

  perform check_that('Submit works with essay marking points', not (with_rubric ? 'error'), with_rubric::text);
  perform check_that('Same total with and without essay marking points (4 marks auto-marked, essay left for the teacher)',
    (with_rubric ->> 'total_score')::numeric = (without_rubric ->> 'total_score')::numeric and (with_rubric ->> 'total_score')::numeric = 5, with_rubric::text || ' vs ' || without_rubric::text);
  perform check_that('Exam is NOT marked fully graded: the essay waits for the teacher, with or without marking points',
    (with_rubric ->> 'fully_graded')::boolean = false and (without_rubric ->> 'fully_graded')::boolean = false);
  perform check_that('The essay response has no mark yet (not auto-marked zero)', (select points_awarded is null from responses where session_id = u(691) and question_id = u(504)));
  perform check_that('Maximum is unchanged (9)', (with_rubric ->> 'max_possible_score')::numeric = 9);
end $$;

-- ============ what a student can read ============
create or replace function rows_as(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute 'select count(*) from (' || p_sql || ') t' into n;
  reset role;
  return n;
end $$;
update questions set essay_rubric = '[{"text":"Simple interest is on the original amount","marks":4}]' where id = u(504);
select check_that('A student cannot read an essay question (so not its marking points) through the table',
  rows_as(u(101), 'select essay_rubric from questions where id = ''' || u(504) || '''') = 0);
select check_that('Teacher who set the exam can read the marking points', rows_as(u(11), 'select essay_rubric from questions where id = ''' || u(504) || ''' and essay_rubric is not null') = 1);
select check_that('Another teacher cannot read them', rows_as(u(12), 'select essay_rubric from questions where id = ''' || u(504) || '''') = 0);

update questions set essay_rubric = null where id = u(504);
select case when ok then 'PASS  ' else 'FAIL  ' end || name || case when ok then '' else '   <-- ' || coalesce(detail, '') end as result from results order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from results;
do $$ begin if exists (select 1 from results where not ok) then raise exception 'essay rubric tests failed'; end if; end $$;
