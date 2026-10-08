-- Tests for migration 097. Throwaway database only; needs the demo fixture. Every line should say PASS.
create temp table results (n serial, name text, ok boolean);
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean) returns void language sql as $$ insert into results (name, ok) values (p_name, coalesce(p_ok, false)) $$;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.exam_access_passwords, public.exam_password_checks from authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on function public.exam_password_unlocked(text, uuid) from authenticated;
create or replace function pg_temp.try_as(who uuid, stmt text) returns text language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true); set local role authenticated; execute stmt; reset role; return 'ok';
exception when others then reset role; return sqlstate || ':' || sqlerrm; end $$;
create or replace function pg_temp.val_as(who uuid, q text) returns text language plpgsql as $$
declare r text;
begin perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true); set local role authenticated; execute q into r; reset role; return r;
exception when others then reset role; return 'ERR ' || sqlstate; end $$;

delete from exam_sessions where draft_exam_id in (select id from draft_exams where title like 'PW97%') or final_exam_id in (select id from final_exams where title like 'PW97%');
delete from draft_exam_class_groups where draft_exam_id in (select id from draft_exams where title like 'PW97%'); delete from final_exam_class_groups where final_exam_id in (select id from final_exams where title like 'PW97%');
delete from draft_exams where title like 'PW97%'; delete from final_exams where title like 'PW97%';
do $$
declare
  t uuid := pg_temp.u(1); hod uuid := pg_temp.u(2); t2 uuid := pg_temp.u(4); st uuid := pg_temp.u(11); st2 uuid := pg_temp.u(10); other uuid := pg_temp.u(12);
  dept uuid := pg_temp.u(900); ex uuid := pg_temp.u(9701); nopw uuid := pg_temp.u(9702); fe uuid := pg_temp.u(9703); r text; i int;
begin
  insert into auth.users (id, email) values (pg_temp.u(79), 'hodB97@mhs.smartassess') on conflict do nothing;
  insert into departments (id, name) values (pg_temp.u(901), 'Science') on conflict do nothing;
  insert into profiles (id, full_name, role, department_id, is_active) values (pg_temp.u(79), 'HOD Other', 'supervisor', pg_temp.u(901), true) on conflict (id) do nothing;
  update departments set head_id = pg_temp.u(79) where id = pg_temp.u(901);
  update departments set head_id = hod where id = dept;

  -- a published direct test with a password, for class 3-1 (student 11 is in 3-1; student 10 is in 1-1)
  insert into draft_exams (id, title, subject, created_by, status, department_id, target_grade, duration_minutes, exam_kind, direct_published) values (ex, 'PW97 with password', 'Mathematics', t, 'published', dept, 9, 30, 'class_test', true);
  insert into draft_exams (id, title, subject, created_by, status, department_id, target_grade, duration_minutes, exam_kind, direct_published) values (nopw, 'PW97 no password', 'Mathematics', t, 'published', dept, 9, 30, 'class_test', true);
  insert into draft_exam_class_groups (draft_exam_id, class_group_id) values (ex, pg_temp.u(801)), (nopw, pg_temp.u(801));
  update draft_exams set access_password = 'Ab3Xk9' where id = ex;

  perform pg_temp.chk('the password is saved in the new table, not on the exam row', (select access_password is null from draft_exams where id = ex) and (select password = 'Ab3Xk9' from exam_access_passwords where exam_kind = 'draft' and exam_id = ex));
  update draft_exams set instructions = 'x' where id = ex;
  perform pg_temp.chk('an update that does not touch the password leaves it alone', (select password = 'Ab3Xk9' from exam_access_passwords where exam_kind = 'draft' and exam_id = ex));
  perform pg_temp.chk('the exam''s teacher can read the password', pg_temp.val_as(t, format($q$select exam_access_password('draft', %L)$q$, ex)) = 'Ab3Xk9');
  perform pg_temp.chk('the head of its department can read it', pg_temp.val_as(hod, format($q$select exam_access_password('draft', %L)$q$, ex)) = 'Ab3Xk9');
  perform pg_temp.chk('another teacher cannot', pg_temp.val_as(t2, format($q$select exam_access_password('draft', %L)$q$, ex)) is null);
  perform pg_temp.chk('the head of another department cannot', pg_temp.val_as(pg_temp.u(79), format($q$select exam_access_password('draft', %L)$q$, ex)) is null);
  perform pg_temp.chk('a student cannot read it (function)', pg_temp.val_as(st, format($q$select exam_access_password('draft', %L)$q$, ex)) is null);
  perform pg_temp.chk('a student cannot read the passwords table', pg_temp.try_as(st, 'select * from exam_access_passwords') like '42501%');
  perform pg_temp.chk('a teacher cannot read the passwords table directly either', pg_temp.try_as(t, 'select * from exam_access_passwords') like '42501%');
  perform pg_temp.chk('the exam row a student reads has no password', pg_temp.val_as(st, format($q$select coalesce(access_password, 'EMPTY') from draft_exams where id = %L$q$, ex)) = 'EMPTY');

  -- starting without the password is refused by the database
  r := pg_temp.try_as(st, format($q$insert into exam_sessions (draft_exam_id, student_id, status, time_limit_seconds) values (%L, %L, 'in_progress', 1800)$q$, ex, st));
  perform pg_temp.chk('starting a sitting without the password is refused', r like '42501%' and r like '%password%');
  perform pg_temp.chk('a wrong password answers wrong', pg_temp.val_as(st, format($q$select verify_exam_password('draft', %L, 'nope')$q$, ex)) = 'wrong');
  r := pg_temp.try_as(st, format($q$insert into exam_sessions (draft_exam_id, student_id, status, time_limit_seconds) values (%L, %L, 'in_progress', 1800)$q$, ex, st));
  perform pg_temp.chk('a wrong try does not unlock', r like '42501%');
  perform pg_temp.chk('the right password (any letter case, spaces around) answers ok', pg_temp.val_as(st, format($q$select verify_exam_password('draft', %L, '  aB3xK9 ')$q$, ex)) = 'ok');
  r := pg_temp.try_as(st, format($q$insert into exam_sessions (draft_exam_id, student_id, status, time_limit_seconds) values (%L, %L, 'in_progress', 1800)$q$, ex, st));
  perform pg_temp.chk('after unlocking the sitting starts', r = 'ok');
  perform pg_temp.chk('a student not in the class cannot even check the password', pg_temp.val_as(st2, format($q$select verify_exam_password('draft', %L, 'Ab3Xk9')$q$, ex)) like 'ERR 42501');
  r := pg_temp.try_as(other, format($q$insert into exam_sessions (draft_exam_id, student_id, status, time_limit_seconds) values (%L, %L, 'in_progress', 1800)$q$, ex, other));
  perform pg_temp.chk('another student''s unlock is not shared', r like '42501%');

  -- lockout: 8 wrong tries lock that student out for 10 minutes, even with the right password
  for i in 1..8 loop perform pg_temp.val_as(other, format($q$select verify_exam_password('draft', %L, 'wrong%s')$q$, ex, i)); end loop;
  perform pg_temp.chk('eight wrong tries lock the student out', pg_temp.val_as(other, format($q$select verify_exam_password('draft', %L, 'Ab3Xk9')$q$, ex)) = 'locked');
  update exam_password_checks set last_failed_at = now() - interval '11 minutes' where student_id = other;
  perform pg_temp.chk('the lock ends after ten minutes', pg_temp.val_as(other, format($q$select verify_exam_password('draft', %L, 'Ab3Xk9')$q$, ex)) = 'ok');

  -- changing the password cancels earlier unlocks
  update draft_exams set access_password = 'ZZ99zz' where id = ex;
  perform pg_temp.chk('a new password removes earlier unlocks', (select count(*) = 0 from exam_password_checks where exam_id = ex));
  perform pg_temp.chk('the new password is the one stored', (select password = 'ZZ99zz' from exam_access_passwords where exam_id = ex));

  -- an exam with no password: no unlock needed
  r := pg_temp.try_as(st, format($q$insert into exam_sessions (draft_exam_id, student_id, status, time_limit_seconds) values (%L, %L, 'in_progress', 1800)$q$, nopw, st));
  perform pg_temp.chk('an exam with no password starts without unlocking', r = 'ok');

  -- final exams
  insert into final_exams (id, title, subject, created_by, duration_minutes, status, department_id) values (fe, 'PW97 final', 'Mathematics', t, 60, 'published', dept);
  insert into final_exam_class_groups (final_exam_id, class_group_id) values (fe, pg_temp.u(801));
  update final_exams set access_password = 'F1nal7' where id = fe;
  perform pg_temp.chk('final exam: password moved to the new table', (select access_password is null from final_exams where id = fe) and (select password = 'F1nal7' from exam_access_passwords where exam_kind = 'final' and exam_id = fe));
  perform pg_temp.chk('final exam: the head of the department reads it', pg_temp.val_as(hod, format($q$select exam_access_password('final', %L)$q$, fe)) = 'F1nal7');
  perform pg_temp.chk('final exam: the exam''s own teacher (not head) cannot', pg_temp.val_as(t, format($q$select exam_access_password('final', %L)$q$, fe)) is null);
  r := pg_temp.try_as(st, format($q$insert into exam_sessions (final_exam_id, student_id, status, time_limit_seconds) values (%L, %L, 'in_progress', 3600)$q$, fe, st));
  perform pg_temp.chk('final exam: starting without the password is refused', r like '42501%');
  perform pg_temp.val_as(st, format($q$select verify_exam_password('final', %L, 'F1nal7')$q$, fe));
  r := pg_temp.try_as(st, format($q$insert into exam_sessions (final_exam_id, student_id, status, time_limit_seconds) values (%L, %L, 'in_progress', 3600)$q$, fe, st));
  perform pg_temp.chk('final exam: after unlocking it starts', r = 'ok');

  -- deleting an exam removes its password
  delete from exam_sessions where final_exam_id = fe or draft_exam_id in (ex, nopw);
  delete from final_exam_class_groups where final_exam_id = fe; delete from draft_exam_class_groups where draft_exam_id in (ex, nopw);
  delete from final_exams where id = fe; delete from draft_exams where id in (ex, nopw);
  perform pg_temp.chk('deleting an exam removes its stored password and unlocks', (select count(*) = 0 from exam_access_passwords where exam_id in (ex, nopw, fe)) and (select count(*) = 0 from exam_password_checks where exam_id in (ex, nopw, fe)));
end $$;
select n, case when ok then 'PASS' else 'FAIL' end as result, name from results order by n;
select count(*) filter (where not ok) as failed, count(*) as total from results;
