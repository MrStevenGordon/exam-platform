-- Tests for migration 096. Throwaway database only; needs the demo fixture. Every line should say PASS.
create temp table results (n serial, name text, ok boolean);
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean) returns void language sql as $$ insert into results (name, ok) values (p_name, coalesce(p_ok, false)) $$;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
create or replace function pg_temp.try_as(who uuid, stmt text, adm boolean default false) returns text language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated', 'app_metadata', json_build_object('is_system_admin', adm))::text, true); set local role authenticated; execute stmt; reset role; return 'ok';
exception when others then reset role; return sqlstate; end $$;

do $$
declare st uuid := pg_temp.u(11); ad uuid := pg_temp.u(78); t uuid := pg_temp.u(1); r text;
begin
  insert into auth.users (id, email) values (ad, 'admin96@mhs.smartassess') on conflict do nothing;
  insert into profiles (id, full_name, role, is_active) values (ad, 'Admin 96', 'admin', true) on conflict (id) do nothing;
  r := pg_temp.try_as(st, format($q$update profiles set role = 'teacher' where id = %L$q$, st));
  perform pg_temp.chk('a student cannot make themselves a teacher', r = '42501' and (select role = 'student' from profiles where id = st));
  perform pg_temp.chk('a student cannot mark themselves a system admin', pg_temp.try_as(st, format($q$update profiles set is_system_admin = true where id = %L$q$, st)) = '42501');
  perform pg_temp.chk('a student cannot change their department', pg_temp.try_as(st, format($q$update profiles set department_id = %L where id = %L$q$, pg_temp.u(900), st)) = '42501');
  perform pg_temp.chk('a student cannot change their student number', pg_temp.try_as(st, format($q$update profiles set student_id = '00000' where id = %L$q$, st)) = '42501');
  perform pg_temp.chk('a student cannot change their name or accommodations', pg_temp.try_as(st, format($q$update profiles set full_name = 'X' where id = %L$q$, st)) = '42501' and pg_temp.try_as(st, format($q$update profiles set accommodations = '{"extra_time":9}'::jsonb where id = %L$q$, st)) = '42501');
  perform pg_temp.chk('a teacher cannot make themselves an admin', pg_temp.try_as(t, format($q$update profiles set role = 'admin' where id = %L$q$, t)) = '42501');
  perform pg_temp.chk('a student can still mark a tour as seen', pg_temp.try_as(st, format($q$update profiles set onboarding_tours_seen = '{"x":true}'::jsonb where id = %L$q$, st)) = 'ok');
  perform pg_temp.chk('a student can still take and release the device lock', pg_temp.try_as(st, format($q$update profiles set active_login_token = 'tok', active_login_started_at = now(), active_login_last_seen_at = now() where id = %L$q$, st)) = 'ok' and pg_temp.try_as(st, format($q$update profiles set active_login_token = null, active_login_started_at = null where id = %L$q$, st)) = 'ok');
  perform pg_temp.chk('a user can still clear the must-change-password flag', pg_temp.try_as(st, format($q$update profiles set must_change_password = false where id = %L$q$, st)) = 'ok');
  r := pg_temp.try_as(ad, format($q$update profiles set grade_level = 10 where id = %L$q$, st));
  perform pg_temp.chk('the school admin can still change a profile (grade)', r = 'ok' and (select grade_level = 10 from profiles where id = st));
  perform pg_temp.chk('a system admin (by sign-in token) can change anything', pg_temp.try_as(st, format($q$update profiles set grade_level = 11 where id = %L$q$, st), true) = 'ok');
  update profiles set grade_level = 9 where id = st;
  perform pg_temp.chk('the server (no signed-in person) can change anything', (select grade_level = 9 from profiles where id = st));
  delete from profiles where id = ad; delete from auth.users where id = ad;
end $$;
select n, case when ok then 'PASS' else 'FAIL' end as result, name from results order by n;
select count(*) filter (where not ok) as failed, count(*) as total from results;
