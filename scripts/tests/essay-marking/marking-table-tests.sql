-- Tests for migration 082 (essay_ai_marking). Run on a throwaway database AFTER seed.sql and 082 (082 last, so the seed's
-- blanket grants do not hide what 082 itself grants). Prints PASS or FAIL per check.
create temp table results (name text, ok boolean, detail text);
create or replace function check_that(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;

delete from essay_ai_marking;
-- the essay answer of student 1 on the Class Test (session 601, question 504), set by Teacher1
create temp table target as select id from responses where session_id = u(601) and question_id = u(504);
insert into essay_ai_marking (response_id, suggestion, model, created_by)
  select id, '{"v":1,"points":[{"index":1,"marks":2}],"total":2,"max":4}'::jsonb, 'claude-sonnet-5', u(11) from target;

create or replace function as_user(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true); set local role authenticated; end $$;
create or replace function n_rows(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin perform as_user(p_uid); execute 'select count(*) from (' || p_sql || ') t' into n; reset role; return n; end $$;
create or replace function try_sql(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare n bigint;
begin
  perform as_user(p_uid);
  begin execute p_sql; get diagnostics n = row_count; reset role; return 'ok:' || n;
  exception when others then reset role; return 'error:' || sqlstate; end;
end $$;

-- ============ who can read ============
select check_that('Teacher who set the test can read the suggestion', n_rows(u(11), 'select 1 from essay_ai_marking') = 1);
select check_that('Head of Maths can read it', n_rows(u(3), 'select 1 from essay_ai_marking') = 1);
select check_that('Admin can read it', n_rows(u(1), 'select 1 from essay_ai_marking') = 1);
select check_that('Another Maths teacher cannot', n_rows(u(12), 'select 1 from essay_ai_marking') = 0);
select check_that('Science teacher cannot', n_rows(u(13), 'select 1 from essay_ai_marking') = 0);
select check_that('Head of Science cannot', n_rows(u(4), 'select 1 from essay_ai_marking') = 0);
select check_that('THE STUDENT WHO WROTE THE ESSAY cannot read the suggestion', n_rows(u(101), 'select 1 from essay_ai_marking') = 0);
select check_that('Another student cannot', n_rows(u(102), 'select 1 from essay_ai_marking') = 0);
select check_that('The student can still read their own response row, and the suggestion is not a column on it',
  n_rows(u(101), 'select 1 from responses where session_id = ''' || u(601) || ''' and question_id = ''' || u(504) || '''') = 1
  and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'responses' and column_name in ('ai_marking', 'suggestion')));

-- ============ who can write ============
select check_that('A teacher cannot insert a suggestion', try_sql(u(11), 'insert into essay_ai_marking (response_id, suggestion, model) select id, ''{"points":[]}''::jsonb, ''x'' from responses where id <> (select id from target) limit 1') like 'error:%');
select check_that('A teacher cannot change the AI suggestion itself', try_sql(u(11), 'update essay_ai_marking set suggestion = ''{"points":[],"total":4}''::jsonb') = 'error:42501');
select check_that('A teacher cannot delete a suggestion', try_sql(u(11), 'delete from essay_ai_marking') like 'error:%');
select check_that('Teacher who set the test CAN record their final marks', try_sql(u(11), 'update essay_ai_marking set final_marks = ''[2,1]''::jsonb, final_total = 3, finalized_by = ''' || u(11) || ''', finalized_at = now()') = 'ok:1');
select check_that('Another teacher records nothing (cannot see the row)', try_sql(u(12), 'update essay_ai_marking set final_marks = ''[0,0]''::jsonb') = 'ok:0');
select check_that('A student cannot record final marks', try_sql(u(101), 'update essay_ai_marking set final_marks = ''[4,4]''::jsonb') in ('ok:0', 'error:42501'));
select check_that('The recorded final marks are the teacher''s, untouched by others', (select final_marks = '[2, 1]'::jsonb and final_total = 3 from essay_ai_marking));
select check_that('Students and anonymous have no privileges on the table at all', not has_table_privilege('anon', 'public.essay_ai_marking', 'select') and not has_table_privilege('anon', 'public.essay_ai_marking', 'insert'));

-- ============ shape rules and clean-up ============
do $$ declare ok boolean; rid uuid;
begin
  select id into rid from responses where session_id = u(601) and question_id = u(501);
  begin insert into essay_ai_marking (response_id, suggestion, model) values (rid, '[]'::jsonb, 'x'); ok := false; exception when check_violation then ok := true; end;
  perform check_that('A suggestion that is not an object with points is refused', ok);
  begin insert into essay_ai_marking (response_id, suggestion, model) values (rid, '{"a":1}'::jsonb, 'x'); ok := false; exception when check_violation then ok := true; end;
  perform check_that('A suggestion without points is refused', ok);
  begin update essay_ai_marking set final_marks = '{"a":1}'::jsonb; ok := false; exception when check_violation then ok := true; end;
  perform check_that('Final marks that are not a list are refused', ok);
end $$;
-- clean-up check uses a response of its own, so the seed data is untouched and the file can be run again
do $$ declare rid uuid := gen_random_uuid(); n1 bigint; n2 bigint;
begin
  insert into exam_sessions (id, student_id, draft_exam_id, status) values (u(699), u(108), u(401), 'in_progress');
  insert into responses (id, session_id, question_id, answer) values (rid, u(699), u(504), 'temporary');
  insert into essay_ai_marking (response_id, suggestion, model) values (rid, '{"points":[]}'::jsonb, 'x');
  select count(*) into n1 from essay_ai_marking where response_id = rid;
  delete from responses where id = rid;
  select count(*) into n2 from essay_ai_marking where response_id = rid;
  delete from exam_sessions where id = u(699);
  perform check_that('Deleting a response removes its suggestion', n1 = 1 and n2 = 0);
end $$;
delete from essay_ai_marking;

select case when ok then 'PASS  ' else 'FAIL  ' end || name || case when ok then '' else '   <-- ' || coalesce(detail, '') end as result from results order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from results;
do $$ begin if exists (select 1 from results where not ok) then raise exception 'marking table tests failed'; end if; end $$;
