-- Tests for migration 098. Throwaway database only; needs the demo fixture and migrations 097 and 098. Every line should say PASS.
create temp table results (n serial, name text, ok boolean);
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean) returns void language sql as $$ insert into results (name, ok) values (p_name, coalesce(p_ok, false)) $$;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.exam_access_passwords, public.exam_password_checks, public.exam_password_reveals from authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on function public.exam_password_unlocked(text, uuid), public.exam_password_access(text, uuid), public.exam_password_reveal_from(text, uuid) from authenticated;
create or replace function pg_temp.val_as(who uuid, q text) returns text language plpgsql as $$
declare r text;
begin perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true); set local role authenticated; execute q into r; reset role; return r;
exception when others then reset role; return 'ERR ' || sqlstate || ' ' || sqlerrm; end $$;

delete from draft_exam_class_groups where draft_exam_id in (select id from draft_exams where title like 'PW98%'); delete from final_exam_class_groups where final_exam_id in (select id from final_exams where title like 'PW98%');
delete from draft_exams where title like 'PW98%'; delete from final_exams where title like 'PW98%';
do $$
declare
  t uuid := pg_temp.u(1); hod uuid := pg_temp.u(2); t2 uuid := pg_temp.u(4); st uuid := pg_temp.u(11); ad uuid := pg_temp.u(78); hodB uuid := pg_temp.u(79);
  dept uuid := pg_temp.u(900); soon uuid := pg_temp.u(9801); later uuid := pg_temp.u(9802); noopen uuid := pg_temp.u(9803); fe uuid := pg_temp.u(9804); r text; j jsonb;
begin
  insert into auth.users (id, email) values (ad, 'admin98@mhs.smartassess'), (hodB, 'hodB98@mhs.smartassess') on conflict do nothing;
  insert into departments (id, name) values (pg_temp.u(901), 'Science') on conflict do nothing;
  insert into profiles (id, full_name, role, is_active) values (ad, 'Admin 98', 'admin', true) on conflict (id) do nothing;
  insert into profiles (id, full_name, role, department_id, is_active) values (hodB, 'HOD Other', 'supervisor', pg_temp.u(901), true) on conflict (id) do nothing;
  update departments set head_id = hodB where id = pg_temp.u(901);
  update departments set head_id = hod where id = dept;

  insert into draft_exams (id, title, subject, created_by, status, department_id, target_grade, duration_minutes, exam_kind, direct_published, available_from)
    values (soon, 'PW98 opens in 30 min', 'Mathematics', t, 'published', dept, 9, 30, 'class_test', true, now() + interval '30 minutes'),
           (later, 'PW98 opens in 3 hours', 'Mathematics', t, 'published', dept, 9, 30, 'class_test', true, now() + interval '3 hours'),
           (noopen, 'PW98 no opening time', 'Mathematics', t, 'published', dept, 9, 30, 'class_test', true, null);
  update draft_exams set access_password = 'Abc123' where id in (soon, later, noopen);

  perform pg_temp.chk('the direct reader is gone', not exists (select 1 from pg_proc where proname = 'exam_access_password'));
  perform pg_temp.chk('the teacher, from 60 minutes before the exam opens, can reveal', pg_temp.val_as(t, format($q$select reveal_exam_password('draft', %L)$q$, soon)) = 'Abc123');
  r := pg_temp.val_as(t, format($q$select reveal_exam_password('draft', %L)$q$, later));
  perform pg_temp.chk('the teacher, 3 hours before, is refused with the time shown', r like 'ERR P0001%can be revealed from%');
  perform pg_temp.chk('an exam with no opening time can be revealed any time', pg_temp.val_as(t, format($q$select reveal_exam_password('draft', %L)$q$, noopen)) = 'Abc123');
  perform pg_temp.chk('the head of the department can reveal 3 hours before', pg_temp.val_as(hod, format($q$select reveal_exam_password('draft', %L)$q$, later)) = 'Abc123');
  perform pg_temp.chk('the school admin can reveal 3 hours before', pg_temp.val_as(ad, format($q$select reveal_exam_password('draft', %L)$q$, later)) = 'Abc123');
  perform pg_temp.chk('another teacher cannot', pg_temp.val_as(t2, format($q$select reveal_exam_password('draft', %L)$q$, soon)) like 'ERR 42501%');
  perform pg_temp.chk('the head of another department cannot', pg_temp.val_as(hodB, format($q$select reveal_exam_password('draft', %L)$q$, soon)) like 'ERR 42501%');
  perform pg_temp.chk('a student cannot', pg_temp.val_as(st, format($q$select reveal_exam_password('draft', %L)$q$, soon)) like 'ERR 42501%');
  perform pg_temp.chk('the reveals were logged (teacher x1 on soon, plus noopen/hod/admin)', (select count(*) = 4 from exam_password_reveals where exam_id in (soon, later, noopen)));
  perform pg_temp.chk('refused attempts were not logged', (select count(*) = 0 from exam_password_reveals where revealed_by in (t2, st, hodB)));
  perform pg_temp.chk('nobody can read the log table directly', pg_temp.val_as(t, 'select count(*) from exam_password_reveals') like 'ERR 42501%');

  j := pg_temp.val_as(t, format($q$select exam_password_status('draft', %L)$q$, later))::jsonb;
  perform pg_temp.chk('status before the window: has password, cannot reveal yet, shows when', (j->>'has_password')::boolean and not (j->>'can_reveal')::boolean and j->>'reveal_from' is not null);
  perform pg_temp.chk('status never contains the password', position('Abc123' in j::text) = 0);
  j := pg_temp.val_as(hod, format($q$select exam_password_status('draft', %L)$q$, later))::jsonb;
  perform pg_temp.chk('status for the head: can reveal now, last reveal shows who', (j->>'can_reveal')::boolean and j->>'last_revealed_by' = 'Testing HOD');
  perform pg_temp.chk('status for a student or other teacher is empty', pg_temp.val_as(st, format($q$select exam_password_status('draft', %L)$q$, soon)) is null and pg_temp.val_as(t2, format($q$select exam_password_status('draft', %L)$q$, soon)) is null);

  -- final exams: head and admin only
  insert into final_exams (id, title, subject, created_by, duration_minutes, status, department_id, available_from) values (fe, 'PW98 final', 'Mathematics', t, 60, 'published', dept, now() + interval '5 hours');
  update final_exams set access_password = 'F1nal7' where id = fe;
  perform pg_temp.chk('final exam: head reveals any time', pg_temp.val_as(hod, format($q$select reveal_exam_password('final', %L)$q$, fe)) = 'F1nal7');
  perform pg_temp.chk('final exam: the admin reveals too', pg_temp.val_as(ad, format($q$select reveal_exam_password('final', %L)$q$, fe)) = 'F1nal7');
  perform pg_temp.chk('final exam: an ordinary teacher cannot', pg_temp.val_as(t, format($q$select reveal_exam_password('final', %L)$q$, fe)) like 'ERR 42501%');

  -- an exam with no password
  update draft_exams set title = 'PW98 plain' where id = noopen;
  delete from exam_access_passwords where exam_id = noopen;
  perform pg_temp.chk('no password stored: status is empty', pg_temp.val_as(t, format($q$select exam_password_status('draft', %L)$q$, noopen)) is null);

  -- deleting the exam deletes its reveal log
  delete from draft_exam_class_groups where draft_exam_id in (soon, later, noopen); delete from final_exam_class_groups where final_exam_id = fe;
  delete from final_exams where id = fe; delete from draft_exams where id in (soon, later, noopen);
  perform pg_temp.chk('deleting exams removes their reveal log', (select count(*) = 0 from exam_password_reveals where exam_id in (soon, later, noopen, fe)));
  update departments set head_id = null where id = pg_temp.u(901);
  delete from profiles where id in (ad, hodB); delete from auth.users where id in (ad, hodB);
end $$;
select n, case when ok then 'PASS' else 'FAIL' end as result, name from results order by n;
select count(*) filter (where not ok) as failed, count(*) as total from results;
