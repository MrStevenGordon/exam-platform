-- Tests for migration 086 (three levels of practice on a lesson check). Run on a throwaway database AFTER the student-topics seed.sql and
-- 086 (086 last). Last table: failed = 0.
create temp table results (name text, ok boolean, detail text);
create or replace function check_that(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;
create or replace function as_user(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true); set local role authenticated; end $$;
create or replace function call_as(p_uid uuid, p_sql text) returns jsonb language plpgsql as $$
declare r jsonb;
begin perform as_user(p_uid); execute p_sql into r; reset role; return r; end $$;
create or replace function err_as(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare r jsonb;
begin perform as_user(p_uid); begin execute p_sql into r; reset role; return 'ok'; exception when others then reset role; return sqlstate; end; end $$;
create or replace function try_sql(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare n bigint;
begin perform as_user(p_uid); begin execute p_sql; get diagnostics n = row_count; reset role; return 'ok:' || n;
  exception when others then reset role; return 'error:' || sqlstate; end; end $$;

delete from learning_lessons; delete from enrollments; delete from class_groups;
insert into departments (id, name) values (u(201), 'Mathematics') on conflict do nothing;
insert into class_groups (id, name, year_grade, department_id) values (u(301), '4-1', '10', u(201)), (u(302), '4-2', '10', u(201));
insert into enrollments (student_id, class_group_id) values (u(101), u(301)), (u(102), u(301)), (u(103), u(302));
create or replace function steps_ok() returns jsonb language sql immutable as $$
  select jsonb_agg(jsonb_build_object('key', k, 'text', 'text', 'resources', '[]'::jsonb, 'approved', true)) from unnest(array['engage','explore','explain','elaborate','evaluate']) k $$;
insert into learning_lessons (id, teacher_id, title, subject, grade, topic_id, steps, status, published_at) values
  (u(1101), u(11), 'Leveled lesson', 'Mathematics', 10, u(701), steps_ok(), 'published', now()),
  (u(1102), u(11), 'Old style lesson (core only)', 'Mathematics', 10, u(701), steps_ok(), 'published', now()),
  (u(1103), u(11), 'Support only lesson', 'Mathematics', 10, u(701), steps_ok(), 'published', now()),
  (u(1104), u(11), 'No questions lesson', 'Mathematics', 10, u(701), steps_ok(), 'published', now());
insert into learning_assignments (lesson_id, class_group_id, assigned_by, keep_open) select l, u(301), u(11), true from unnest(array[u(1101), u(1102), u(1103), u(1104)]) l;
-- leveled lesson: core = Q1 (right answer index 1), Q2 (index 0), Q3 numeric 12; support = S1 (index 2), S2 (index 0); stretch = X1 (index 3)
insert into learning_check_questions (id, lesson_id, position, kind, prompt, options, correct_index, level) values
  (u(1201), u(1101), 1, 'multiple_choice', 'Core Q1', '["a","b","c"]', 1, 'core'),
  (u(1202), u(1101), 2, 'multiple_choice', 'Core Q2', '["a","b","c"]', 0, 'core'),
  (u(1204), u(1101), 4, 'multiple_choice', 'Support S1', '["a","b","c"]', 2, 'support'),
  (u(1205), u(1101), 5, 'multiple_choice', 'Support S2', '["a","b","c"]', 0, 'support'),
  (u(1206), u(1101), 6, 'multiple_choice', 'Stretch X1', '["a","b","c","d"]', 3, 'stretch');
insert into learning_check_questions (id, lesson_id, position, kind, prompt, correct_number, tolerance, level) values (u(1203), u(1101), 3, 'numeric', 'Core Q3', 12, 0, 'core');
-- old style lesson: questions inserted WITHOUT naming a level (as before this migration)
insert into learning_check_questions (id, lesson_id, position, kind, prompt, options, correct_index) values (u(1301), u(1102), 1, 'multiple_choice', 'Old Q1', '["a","b"]', 0), (u(1302), u(1102), 2, 'multiple_choice', 'Old Q2', '["a","b"]', 1);
insert into learning_check_questions (id, lesson_id, position, kind, prompt, options, correct_index, level) values (u(1401), u(1103), 1, 'multiple_choice', 'Only support', '["a","b"]', 0, 'support');

create temp table g_default as select call_as(u(101), format('select public.learning_get_check(%L)', u(1101))) as j;
create temp table g_support as select call_as(u(101), format('select public.learning_get_check(%L, ''support'')', u(1101))) as j;
create temp table g_stretch as select call_as(u(101), format('select public.learning_get_check(%L, ''stretch'')', u(1101))) as j;

-- ============ backwards compatibility ============
select check_that('Existing questions (written without a level) are core', (select count(*) from learning_check_questions where lesson_id = u(1102) and level = 'core') = 2);
select check_that('The one-argument call still works and gives the CORE questions (3)', jsonb_array_length((select j -> 'questions' from g_default)) = 3 and (select j ->> 'level' from g_default) = 'core');
select check_that('A lesson with only core questions reports just one level (so the app shows no choice)', (select j -> 'levels' from (select call_as(u(101), format('select public.learning_get_check(%L)', u(1102))) j) x) = '["core"]'::jsonb);

-- ============ getting a level ============
select check_that('A leveled lesson lists its levels in order support, core, stretch', (select j -> 'levels' from g_default) = '["support","core","stretch"]'::jsonb);
select check_that('Support gives the 2 support questions', jsonb_array_length((select j -> 'questions' from g_support)) = 2 and (select j ->> 'level' from g_support) = 'support');
select check_that('Stretch gives the 1 stretch question', jsonb_array_length((select j -> 'questions' from g_stretch)) = 1);
select check_that('The support questions are the support ones and none of the core ones', (select string_agg(e ->> 'prompt', ',' order by e ->> 'prompt') from g_support, jsonb_array_elements(j -> 'questions') e) = 'Support S1,Support S2');
select check_that('NO right answers are sent with the questions', (select j::text from g_default) !~ 'correct_index|correct_number|explanation' and (select j::text from g_support) !~ 'correct_index|correct_number');
select check_that('A lesson with only a support level defaults to support', (select j ->> 'level' from (select call_as(u(101), format('select public.learning_get_check(%L)', u(1103))) j) x) = 'support');
select check_that('Asking for a level the lesson does not have falls back (core)', (select j ->> 'level' from (select call_as(u(101), format('select public.learning_get_check(%L, ''stretch'')', u(1102))) j) x) = 'core');
select check_that('A lesson with no questions returns an empty list', jsonb_array_length((select j -> 'questions' from (select call_as(u(101), format('select public.learning_get_check(%L)', u(1104))) j) x)) = 0);
select check_that('An invented level is refused', err_as(u(101), format('select public.learning_get_check(%L, ''expert'')', u(1101))) = 'P0001');
select check_that('A student not in the class is refused', err_as(u(103), format('select public.learning_get_check(%L)', u(1101))) = '42501');

-- ============ answering ============
-- core answers: Q1=1, Q2=0, Q3=12 -> all right. These are the FIRST attempt.
create temp table sub1 as select call_as(u(101), format('select public.learning_submit_check(%L, %L::jsonb)', u(1101), jsonb_build_object(u(1201)::text, 1, u(1202)::text, 0, u(1203)::text, '12'))) as j;
select check_that('Core submit with the old two-argument call: 3 of 3, attempt 1, level core', (select (j ->> 'score')::int from sub1) = 3 and (select (j ->> 'max')::int from sub1) = 3 and (select j ->> 'level' from sub1) = 'core' and (select (j ->> 'first_try')::boolean from sub1));
select check_that('The right answers come back only now, after submitting', (select j::text from sub1) ~ 'correct_answer');
select check_that('The first attempt is recorded as evidence, with its level', exists (select 1 from student_evidence where student_id = u(101) and source_ref = u(1101) and (detail ->> 'level') = 'core' and score = 3 and max_score = 3));

create temp table sub2 as select call_as(u(101), format('select public.learning_submit_check(%L, %L::jsonb, ''support'')', u(1101), jsonb_build_object(u(1204)::text, 2, u(1205)::text, 1))) as j;
select check_that('Support submit marks only the support questions: 1 of 2 (S1 right, S2 wrong), attempt 2, practice', (select (j ->> 'score')::int from sub2) = 1 and (select (j ->> 'max')::int from sub2) = 2 and (select j ->> 'level' from sub2) = 'support' and not (select (j ->> 'first_try')::boolean from sub2));
select check_that('Practice attempts are not recorded as evidence', (select count(*) from student_evidence where student_id = u(101) and source_ref = u(1101)) = 1);
create temp table sub3 as select call_as(u(101), format('select public.learning_submit_check(%L, %L::jsonb, ''stretch'')', u(1101), jsonb_build_object(u(1201)::text, 1, u(1202)::text, 0))) as j;
select check_that('Answers to other levels'' questions earn nothing: stretch with core answers is 0 of 1', (select (j ->> 'score')::int from sub3) = 0 and (select (j ->> 'max')::int from sub3) = 1);
select check_that('Attempts record their level', (select string_agg(level, ',' order by attempt_no) from learning_check_attempts where student_id = u(101) and lesson_id = u(1101)) = 'core,support,stretch');
select check_that('A lesson with no questions cannot be submitted', err_as(u(101), format('select public.learning_submit_check(%L, ''{}''::jsonb)', u(1104))) = 'P0001');
select check_that('A student not in the class cannot submit', err_as(u(103), format('select public.learning_submit_check(%L, ''{}''::jsonb)', u(1101))) = '42501');
select check_that('An invented level cannot be submitted', err_as(u(101), format('select public.learning_submit_check(%L, ''{}''::jsonb, ''expert'')', u(1101))) = 'P0001');
select check_that('Students cannot read the question table directly (answers stay hidden)', (select count(*) from (select call_as(u(101), 'select to_jsonb(count(*)) from learning_check_questions') j) x where (j)::int = 0) = 1);

-- ============ what the teacher sees ============
create temp table res as select call_as(u(11), format('select jsonb_agg(to_jsonb(r)) from public.learning_check_results(%L) r where r.student_id = %L', u(1101), u(101))) as j;
select check_that('The teacher sees the first level (core), the latest level (stretch), 3 attempts and a first try of 3 of 3', (select j -> 0 ->> 'first_level' from res) = 'core' and (select j -> 0 ->> 'last_level' from res) = 'stretch' and (select (j -> 0 ->> 'attempts')::int from res) = 3 and (select (j -> 0 ->> 'first_score')::int from res) = 3);
select check_that('A student who has not tried has no levels yet', (select (j -> 0 -> 'first_level') = 'null'::jsonb from (select call_as(u(11), format('select jsonb_agg(to_jsonb(r)) from public.learning_check_results(%L) r where r.student_id = %L', u(1101), u(102))) j) x));
select check_that('A student cannot see the results table', err_as(u(101), format('select jsonb_agg(to_jsonb(r)) from public.learning_check_results(%L) r', u(1101))) = '42501');
select check_that('A teacher who does not own the lesson cannot', err_as(u(12), format('select jsonb_agg(to_jsonb(r)) from public.learning_check_results(%L) r', u(1101))) = '42501');

-- ============ writing questions: limits are per level ============
select check_that('A teacher can add a core question', try_sql(u(11), format('insert into learning_check_questions (lesson_id, position, kind, prompt, options, correct_index) values (%L, 9, ''multiple_choice'', ''New core'', ''["a","b"]'', 0)', u(1101))) = 'ok:1');
insert into learning_check_questions (lesson_id, position, kind, prompt, options, correct_index, level) select u(1104), g, 'multiple_choice', 'Fill ' || g, '["a","b"]', 0, 'stretch' from generate_series(1, 10) g;
select check_that('The 10th stretch question is allowed', (select count(*) from learning_check_questions where lesson_id = u(1104) and level = 'stretch') = 10);
select check_that('The 11th stretch question is refused', try_sql(u(11), format('insert into learning_check_questions (lesson_id, position, kind, prompt, options, correct_index, level) values (%L, 11, ''multiple_choice'', ''Too many'', ''["a","b"]'', 0, ''stretch'')', u(1104))) = 'error:P0001');
select check_that('The same lesson can still take support questions (limit is per level)', try_sql(u(11), format('insert into learning_check_questions (lesson_id, position, kind, prompt, options, correct_index, level) values (%L, 12, ''multiple_choice'', ''Support ok'', ''["a","b"]'', 0, ''support'')', u(1104))) = 'ok:1');
select check_that('Moving a question INTO a full level is refused', try_sql(u(11), format('update learning_check_questions set level = ''stretch'' where lesson_id = %L and prompt = ''Support ok''', u(1104))) = 'error:P0001');
select check_that('A question cannot have an invented level', try_sql(u(11), format('update learning_check_questions set level = ''expert'' where id = %L', u(1201))) like 'error:%');
select check_that('Editing a question without changing its level is still fine when the level is full', try_sql(u(11), format('update learning_check_questions set prompt = ''Fill 1 (edited)'' where lesson_id = %L and prompt = ''Fill 1''', u(1104))) = 'ok:1');
select check_that('A teacher who does not own the lesson cannot add a question', try_sql(u(12), format('insert into learning_check_questions (lesson_id, position, kind, prompt, options, correct_index, level) values (%L, 20, ''multiple_choice'', ''Nope'', ''["a","b"]'', 0, ''core'')', u(1101))) like 'error:%');
select check_that('The level probe exists for signed-in users', has_function_privilege('authenticated', 'public.check_levels_ready()', 'execute'));

select case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by ok, name;
select count(*) filter (where not ok) as failed, count(*) as total from results;
