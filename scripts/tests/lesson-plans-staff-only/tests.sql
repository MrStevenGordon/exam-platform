-- Tests for migration 094. Throwaway database only; needs the demo fixture (scripts/tests/demo-seed/fixture.sql). Every line should say PASS.
create temp table results (n serial, name text, ok boolean);
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean) returns void language sql as $$ insert into results (name, ok) values (p_name, coalesce(p_ok, false)) $$;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
create or replace function pg_temp.try_as(who uuid, stmt text) returns text language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true); set local role authenticated; execute stmt; reset role; return 'ok';
exception when others then reset role; return sqlstate; end $$;
create or replace function pg_temp.val_as(who uuid, q text) returns text language plpgsql as $$
declare r text;
begin perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true); set local role authenticated; execute q into r; reset role; return r;
exception when others then reset role; return 'ERR ' || sqlstate; end $$;
delete from lesson_plans where topic like 'RLS test%';
do $$
declare t uuid := pg_temp.u(1); hod uuid := pg_temp.u(2); pr uuid := pg_temp.u(3); st uuid := pg_temp.u(11); r text;
begin
  perform pg_temp.chk('a teacher can write their own lesson plan', pg_temp.try_as(t, format($q$insert into lesson_plans (teacher_id, subject, grade, topic) values (%L, 'Mathematics', 'Grade 9', 'RLS test teacher')$q$, t)) = 'ok');
  perform pg_temp.chk('a head of department can too', pg_temp.try_as(hod, format($q$insert into lesson_plans (teacher_id, subject, grade, topic) values (%L, 'Mathematics', 'Grade 9', 'RLS test hod')$q$, hod)) = 'ok');
  perform pg_temp.chk('a student cannot write a lesson plan, even in their own name', pg_temp.try_as(st, format($q$insert into lesson_plans (teacher_id, subject, grade, topic) values (%L, 'x', '9', 'RLS test student')$q$, st)) = '42501');
  perform pg_temp.chk('the principal cannot either (they do not use the lesson plan page)', pg_temp.try_as(pr, format($q$insert into lesson_plans (teacher_id, subject, grade, topic) values (%L, 'x', '9', 'RLS test principal')$q$, pr)) = '42501');
  perform pg_temp.chk('a teacher cannot write a plan in another teacher''s name', pg_temp.try_as(t, format($q$insert into lesson_plans (teacher_id, subject, grade, topic) values (%L, 'x', '9', 'RLS test other')$q$, hod)) = '42501');
  perform pg_temp.chk('a teacher reads only their own plans', pg_temp.val_as(t, $q$select count(*)::text from lesson_plans where topic like 'RLS test%'$q$) = '1');
  perform pg_temp.chk('a teacher can edit and delete their own plan', pg_temp.try_as(t, $q$update lesson_plans set focus_question = 'ok' where topic = 'RLS test teacher'$q$) = 'ok' and pg_temp.try_as(t, $q$delete from lesson_plans where topic = 'RLS test teacher'$q$) = 'ok');
  perform pg_temp.chk('a student reads no lesson plans', pg_temp.val_as(st, 'select count(*)::text from lesson_plans') = '0');
end $$;
delete from lesson_plans where topic like 'RLS test%';
select n, case when ok then 'PASS' else 'FAIL' end as result, name from results order by n;
select count(*) filter (where not ok) as failed, count(*) as total from results;
