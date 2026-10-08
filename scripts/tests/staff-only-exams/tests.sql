-- Tests for migration 095. Throwaway database only; needs the demo fixture (scripts/tests/demo-seed/fixture.sql). Every line should say PASS.
create temp table results (n serial, name text, ok boolean);
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean) returns void language sql as $$ insert into results (name, ok) values (p_name, coalesce(p_ok, false)) $$;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
create or replace function pg_temp.try_as(who uuid, stmt text) returns text language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true); set local role authenticated; execute stmt; reset role; return 'ok';
exception when others then reset role; return sqlstate || ':' || sqlerrm; end $$;
create or replace function pg_temp.val_as(who uuid, q text) returns text language plpgsql as $$
declare r text;
begin perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true); set local role authenticated; execute q into r; reset role; return r;
exception when others then reset role; return 'ERR ' || sqlstate; end $$;

delete from questions where question_text like 'RLS95%'; delete from draft_exam_class_groups where draft_exam_id in (select id from draft_exams where title like 'RLS95%'); delete from draft_exams where title like 'RLS95%';
do $$
declare
  t uuid := pg_temp.u(1); hod uuid := pg_temp.u(2); pr uuid := pg_temp.u(3); st uuid := pg_temp.u(11); tOther uuid := pg_temp.u(4);
  dept uuid := pg_temp.u(900); ex uuid := pg_temp.u(9501); q1 uuid := pg_temp.u(9511); q2 uuid := pg_temp.u(9512); r text; n text;
begin
  -- the fixture: Mathematics head u(2); a second department with its own head so we can show a head cannot review another department's exam
  insert into auth.users (id, email) values (pg_temp.u(76), 'hodB95@mhs.smartassess') on conflict do nothing;
  insert into departments (id, name) values (pg_temp.u(901), 'Science') on conflict do nothing;
  insert into profiles (id, full_name, role, department_id, is_active) values (pg_temp.u(76), 'HOD Science', 'supervisor', pg_temp.u(901), true) on conflict (id) do nothing;
  update departments set head_id = pg_temp.u(76) where id = pg_temp.u(901);
  update departments set head_id = hod where id = dept;

  -- (A) staff only
  perform pg_temp.chk('a teacher can create an exam', pg_temp.try_as(t, format($q$insert into draft_exams (id, title, subject, created_by, status, department_id, target_grade) values (%L, 'RLS95 teacher exam', 'Mathematics', %L, 'draft', %L, 9)$q$, ex, t, dept)) = 'ok');
  perform pg_temp.chk('a student cannot create an exam', pg_temp.try_as(st, format($q$insert into draft_exams (title, subject, created_by, status) values ('RLS95 student exam', 'Mathematics', %L, 'draft')$q$, st)) like '42501%');
  perform pg_temp.chk('the principal cannot either', pg_temp.try_as(pr, format($q$insert into draft_exams (title, subject, created_by, status) values ('RLS95 principal exam', 'Mathematics', %L, 'draft')$q$, pr)) like '42501%');
  perform pg_temp.chk('a teacher can add questions to their exam', pg_temp.try_as(t, format($q$insert into questions (id, draft_exam_id, created_by, question_type, question_text, options, correct_answer, points, order_index) values (%L, %L, %L, 'multiple_choice', 'RLS95 q1', '["a","b","c","d"]', 'a', 1, 1), (%L, %L, %L, 'multiple_choice', 'RLS95 q2', '["a","b","c","d"]', 'a', 1, 2)$q$, q1, ex, t, q2, ex, t)) = 'ok');
  perform pg_temp.chk('a student cannot add a question', pg_temp.try_as(st, format($q$insert into questions (draft_exam_id, created_by, question_type, question_text, options, correct_answer, points, order_index) values (%L, %L, 'multiple_choice', 'RLS95 student q', '["a","b","c","d"]', 'a', 1, 3)$q$, ex, st)) like '42501%');
  perform pg_temp.chk('a teacher can link their exam to a class', pg_temp.try_as(t, format($q$insert into draft_exam_class_groups (draft_exam_id, class_group_id) values (%L, %L)$q$, ex, pg_temp.u(801))) = 'ok');
  perform pg_temp.chk('a student cannot link an exam to a class (even a teacher''s exam)', pg_temp.try_as(st, format($q$insert into draft_exam_class_groups (draft_exam_id, class_group_id) values (%L, %L)$q$, ex, pg_temp.u(802))) like '42501%');
  r := pg_temp.try_as(t, format($q$update questions set points = 2 where id = %L$q$, q1));
  perform pg_temp.chk('a teacher can still edit their own question', r = 'ok' and (select points = 2 from questions where id = q1));
  r := pg_temp.try_as(st, format($q$update questions set points = 9 where id = %L$q$, q1));
  perform pg_temp.chk('a student cannot change that question', (select points = 2 from questions where id = q1));
  perform pg_temp.chk('a student cannot write a report card comment', pg_temp.try_as(st, format($q$insert into report_card_comments (teacher_id, student_id, term_id, subject, comment) values (%L, %L, %L, 'Mathematics', 'RLS95')$q$, st, st, pg_temp.u(1))) like '42501%' or pg_temp.try_as(st, format($q$insert into report_card_comments (teacher_id, student_id) values (%L, %L)$q$, st, st)) like '42501%');

  -- (B) head of department comments: the exam must be waiting for review
  update draft_exams set status = 'draft' where id = ex;
  perform pg_temp.chk('comments are refused while the exam is not waiting for review', pg_temp.try_as(hod, format($q$select save_exam_review_comments(%L, %L::jsonb)$q$, ex, jsonb_build_object(q1::text, 'x')::text)) like 'P0001%');
  update draft_exams set status = 'submitted' where id = ex;
  r := pg_temp.try_as(hod, format($q$select save_exam_review_comments(%L, %L::jsonb)$q$, ex, jsonb_build_object(q1::text, 'Add a worked example', q2::text, '  ')::text));
  perform pg_temp.chk('the head of the exam''s department saves comments', r = 'ok' and (select supervisor_comment = 'Add a worked example' from questions where id = q1) and (select supervisor_comment is null from questions where id = q2));
  perform pg_temp.chk('one call does the whole page (returns how many questions it touched: 2)', pg_temp.val_as(hod, format($q$select save_exam_review_comments(%L, %L::jsonb)$q$, ex, jsonb_build_object(q1::text, 'Add a worked example', q2::text, 'Check option C')::text)) = '2');
  r := pg_temp.try_as(hod, format($q$select save_exam_review_comments(%L, %L::jsonb)$q$, ex, jsonb_build_object(q1::text, '')::text));
  perform pg_temp.chk('an empty comment clears it', r = 'ok' and (select supervisor_comment is null from questions where id = q1));
  perform pg_temp.chk('the head of another department cannot', pg_temp.try_as(pg_temp.u(76), format($q$select save_exam_review_comments(%L, %L::jsonb)$q$, ex, jsonb_build_object(q1::text, 'x')::text)) like '42501%');
  perform pg_temp.chk('the exam''s own teacher cannot review it', pg_temp.try_as(t, format($q$select save_exam_review_comments(%L, %L::jsonb)$q$, ex, jsonb_build_object(q1::text, 'x')::text)) like '42501%');
  perform pg_temp.chk('a student cannot', pg_temp.try_as(st, format($q$select save_exam_review_comments(%L, %L::jsonb)$q$, ex, jsonb_build_object(q1::text, 'x')::text)) like '42501%');
  perform pg_temp.chk('a comment cannot reach a question of another exam', (select count(*) from questions where supervisor_comment = 'leak') = 0 and pg_temp.val_as(hod, format($q$select save_exam_review_comments(%L, %L::jsonb)$q$, ex, jsonb_build_object(pg_temp.u(1)::text, 'leak')::text)) = '0');
  perform pg_temp.chk('a very long comment is refused', pg_temp.try_as(hod, format($q$select save_exam_review_comments(%L, %L::jsonb)$q$, ex, jsonb_build_object(q1::text, repeat('x', 2001))::text)) like 'P0001%');
  perform pg_temp.chk('a signed-out caller is refused', pg_temp.try_as(null, format($q$select save_exam_review_comments(%L, '{}'::jsonb)$q$, ex)) like '%' );
end $$;
delete from questions where question_text like 'RLS95%'; delete from draft_exam_class_groups where draft_exam_id in (select id from draft_exams where title like 'RLS95%'); delete from draft_exams where title like 'RLS95%';
select n, case when ok then 'PASS' else 'FAIL' end as result, name from results order by n;
select count(*) filter (where not ok) as failed, count(*) as total from results;
