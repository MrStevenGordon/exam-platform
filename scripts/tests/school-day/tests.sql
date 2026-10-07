-- Tests for migration 088 (school day, class spans, who may change bell times). Throwaway database only.
-- Needs the demo fixture (scripts/tests/demo-seed/fixture.sql) loaded, then 088 applied. Every line should say PASS.
create temp table results (n serial, name text, ok boolean);
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean) returns void language sql as $$ insert into results (name, ok) values (p_name, coalesce(p_ok, false)) $$;

insert into auth.users (id, email) values (pg_temp.u(95), 'admin@mhs.smartassess'), (pg_temp.u(96), 't2@mhs.smartassess') on conflict do nothing;
insert into profiles (id, full_name, role, is_active) values (pg_temp.u(95), 'Ada Admin', 'admin', true) on conflict (id) do nothing;
insert into profiles (id, full_name, role, department_id, is_active) values (pg_temp.u(96), 'Second Teacher', 'teacher', pg_temp.u(900), true) on conflict (id) do nothing;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- runs a statement as a person; returns 'ok' or the SQLSTATE of the error
create or replace function pg_temp.try_as(who uuid, stmt text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute stmt;
  reset role;
  return 'ok';
exception when others then
  reset role;
  return sqlstate;
end $$;
create or replace function pg_temp.try_sys(stmt text) returns text language plpgsql as $$
begin execute stmt; return 'ok'; exception when others then return sqlstate; end $$;

do $$
declare
  admin uuid := pg_temp.u(95); hod uuid := pg_temp.u(2); principal uuid := pg_temp.u(3); teacher uuid := pg_temp.u(1); t2 uuid := pg_temp.u(96); student uuid := pg_temp.u(10);
  r text; p1 uuid; p2 uuid; p3 uuid; cg1 uuid := pg_temp.u(801); cg2 uuid := pg_temp.u(802); dept uuid := pg_temp.u(900);
begin
  -- ===== who may change the bell times =====
  perform pg_temp.chk('the school admin can add a period', pg_temp.try_as(admin, $q$ insert into timetable_periods (name, start_time, end_time, order_index, academic_year) values ('A1', '08:00', '09:00', 0, '2099-2100') $q$) = 'ok');
  perform pg_temp.chk('the principal or a vice principal can add a period', pg_temp.try_as(principal, $q$ insert into timetable_periods (name, start_time, end_time, order_index, academic_year) values ('A2', '09:00', '10:00', 1, '2099-2100') $q$) = 'ok');
  perform pg_temp.chk('a head of department can no longer add a period', pg_temp.try_as(hod, $q$ insert into timetable_periods (name, start_time, end_time, order_index, academic_year) values ('X', '10:00', '11:00', 2, '2099-2100') $q$) = '42501');
  perform pg_temp.chk('a student cannot add a period', pg_temp.try_as(student, $q$ insert into timetable_periods (name, start_time, end_time, order_index, academic_year) values ('X', '10:00', '11:00', 2, '2099-2100') $q$) = '42501');
  r := pg_temp.try_as(hod, $q$ delete from timetable_periods where name = 'A1' $q$);
  perform pg_temp.chk('a head of department cannot delete a period (nothing is removed)', r = 'ok' and exists (select 1 from timetable_periods where name = 'A1'));
  insert into timetable_periods (name, start_time, end_time, order_index, academic_year) values ('A3', '10:00', '11:00', 2, '2099-2100');
  select id into p1 from timetable_periods where name = 'A1'; select id into p2 from timetable_periods where name = 'A2'; select id into p3 from timetable_periods where name = 'A3';
  perform pg_temp.chk('a head of department can still read the periods', pg_temp.try_as(hod, 'select count(*) from timetable_periods') = 'ok');

  -- ===== classes that last more than one period =====
  insert into timetable_sections (department_id, subject, teacher_id, class_group_id, day_of_week, period_id, academic_year, span) values (dept, 'Mathematics', teacher, cg1, 1, p1, '2099-2100', 2);
  perform pg_temp.chk('a double period is accepted', exists (select 1 from timetable_sections where period_id = p1 and span = 2));
  perform pg_temp.chk('the periods a double covers are its own and the next', public.section_period_ids(p1, 2) = array[p1, p2]);
  perform pg_temp.chk('the same teacher cannot be booked into the second hour of their double period',
    pg_temp.try_sys(format($q$ insert into timetable_sections (department_id, subject, teacher_id, class_group_id, day_of_week, period_id, academic_year) values (%L, 'Science', %L, %L, 1, %L, '2099-2100') $q$, dept, teacher, cg2, p2)) = '23505');
  perform pg_temp.chk('the same class cannot be booked into the second hour of its double period',
    pg_temp.try_sys(format($q$ insert into timetable_sections (department_id, subject, teacher_id, class_group_id, day_of_week, period_id, academic_year) values (%L, 'Science', %L, %L, 1, %L, '2099-2100') $q$, dept, t2, cg1, p2)) = '23505');
  perform pg_temp.chk('a different teacher and class can use that second hour',
    pg_temp.try_sys(format($q$ insert into timetable_sections (department_id, subject, teacher_id, class_group_id, day_of_week, period_id, academic_year) values (%L, 'Science', %L, %L, 1, %L, '2099-2100') $q$, dept, t2, cg2, p2)) = 'ok');
  perform pg_temp.chk('a double period cannot run past the last period of the day',
    pg_temp.try_sys(format($q$ insert into timetable_sections (department_id, subject, teacher_id, class_group_id, day_of_week, period_id, academic_year, span) values (%L, 'Art', %L, %L, 1, %L, '2099-2100', 2) $q$, dept, pg_temp.u(4), pg_temp.u(803), p3)) = '23514');
  perform pg_temp.chk('the same teacher and class on another day is fine',
    pg_temp.try_sys(format($q$ insert into timetable_sections (department_id, subject, teacher_id, class_group_id, day_of_week, period_id, academic_year) values (%L, 'Mathematics', %L, %L, 2, %L, '2099-2100') $q$, dept, teacher, cg1, p1)) = 'ok');
  perform pg_temp.chk('lengthening a lesson into free hours is fine', pg_temp.try_sys(format($q$ update timetable_sections set span = 2 where teacher_id = %L and day_of_week = 1 and period_id = %L $q$, t2, p2)) = 'ok');
  perform pg_temp.chk('lengthening it past the end of the day is refused', pg_temp.try_sys(format($q$ update timetable_sections set span = 3 where teacher_id = %L and day_of_week = 1 and period_id = %L $q$, t2, p2)) = '23514');
  perform pg_temp.chk('ordinary single periods still work as before (default span 1)', (select count(*) from timetable_sections where span = 1 and academic_year = '2099-2100') = 1);
  perform pg_temp.chk('a span above 4 is refused', pg_temp.try_sys(format($q$ update timetable_sections set span = 5 where teacher_id = %L and day_of_week = 2 $q$, teacher)) = '23514');

  -- ===== lunch and events =====
  perform pg_temp.chk('the principal can add a weekly lunch window', pg_temp.try_as(principal, $q$ insert into school_day_blocks (kind, title, grades, days, start_time, end_time, academic_year) values ('lunch', 'Lunch', '{7,8,9}', '{1,2,3,4,5}', '11:00', '12:00', '2099-2100') $q$) = 'ok');
  perform pg_temp.chk('the school admin can add one for other grades', pg_temp.try_as(admin, $q$ insert into school_day_blocks (kind, title, grades, days, start_time, end_time, academic_year) values ('lunch', 'Lunch', '{10,11,12}', '{1,2,3,4,5}', '12:00', '13:00', '2099-2100') $q$) = 'ok');
  perform pg_temp.chk('a head of department cannot add lunch or an event', pg_temp.try_as(hod, $q$ insert into school_day_blocks (kind, title, days, start_time, end_time, academic_year) values ('event', 'Devotion', '{1}', '08:00', '09:00', '2099-2100') $q$) = '42501');
  perform pg_temp.chk('a teacher cannot add an event', pg_temp.try_as(teacher, $q$ insert into school_day_blocks (kind, title, days, start_time, end_time, academic_year) values ('event', 'Devotion', '{1}', '08:00', '09:00', '2099-2100') $q$) = '42501');
  perform pg_temp.chk('a weekly event for every grade (grades left empty)', pg_temp.try_as(principal, $q$ insert into school_day_blocks (kind, title, days, start_time, end_time, academic_year) values ('event', 'General devotion', '{1}', '08:00', '09:00', '2099-2100') $q$) = 'ok');
  perform pg_temp.chk('a one-off whole-day event for some grades', pg_temp.try_as(principal, $q$ insert into school_day_blocks (kind, title, grades, date_from, date_to, academic_year) values ('event', 'Sports day', '{7,8,9,10,11}', '2099-11-12', '2099-11-12', '2099-2100') $q$) = 'ok');
  perform pg_temp.chk('a student can read the school day', pg_temp.try_as(student, 'select count(*) from school_day_blocks') = 'ok');
  perform pg_temp.chk('a student sees all of it', (select count(*) from school_day_blocks) = 4);
  perform pg_temp.chk('lunch must say which grades', pg_temp.try_sys($q$ insert into school_day_blocks (kind, title, days, start_time, end_time, academic_year) values ('lunch', 'Lunch', '{1}', '11:00', '12:00', '2099-2100') $q$) = '23514');
  perform pg_temp.chk('an event cannot be both weekly and one-off', pg_temp.try_sys($q$ insert into school_day_blocks (kind, title, days, date_from, date_to, academic_year) values ('event', 'Odd', '{1}', '2099-11-12', '2099-11-12', '2099-2100') $q$) = '23514');
  perform pg_temp.chk('an event must be one or the other', pg_temp.try_sys($q$ insert into school_day_blocks (kind, title, academic_year) values ('event', 'Odd', '2099-2100') $q$) = '23514');
  perform pg_temp.chk('the end time must be after the start', pg_temp.try_sys($q$ insert into school_day_blocks (kind, title, days, start_time, end_time, academic_year) values ('event', 'Odd', '{1}', '09:00', '08:00', '2099-2100') $q$) = '23514');
  perform pg_temp.chk('a start time needs an end time', pg_temp.try_sys($q$ insert into school_day_blocks (kind, title, days, start_time, academic_year) values ('event', 'Odd', '{1}', '09:00', '2099-2100') $q$) = '23514');
  perform pg_temp.chk('a one-off event cannot end before it starts', pg_temp.try_sys($q$ insert into school_day_blocks (kind, title, date_from, date_to, academic_year) values ('event', 'Odd', '2099-11-12', '2099-11-10', '2099-2100') $q$) = '23514');
  perform pg_temp.chk('days must be Monday to Friday', pg_temp.try_sys($q$ insert into school_day_blocks (kind, title, days, start_time, end_time, academic_year) values ('event', 'Odd', '{6}', '08:00', '09:00', '2099-2100') $q$) = '23514');
  perform pg_temp.chk('grades must be 7 to 13', pg_temp.try_sys($q$ insert into school_day_blocks (kind, title, grades, days, start_time, end_time, academic_year) values ('event', 'Odd', '{6}', '{1}', '08:00', '09:00', '2099-2100') $q$) = '23514');
  perform pg_temp.chk('a blank title is refused', pg_temp.try_sys($q$ insert into school_day_blocks (kind, title, days, start_time, end_time, academic_year) values ('event', '   ', '{1}', '08:00', '09:00', '2099-2100') $q$) = '23514');
  perform pg_temp.chk('adding an event does not touch any class (events are an overlay)', (select count(*) from timetable_sections where academic_year = '2099-2100') = 3);
  perform pg_temp.chk('who created it is recorded', (select created_by from school_day_blocks where title = 'General devotion') = pg_temp.u(3));
  r := pg_temp.try_as(principal, $q$ update school_day_blocks set start_time = '08:15' where title = 'General devotion' $q$);
  perform pg_temp.chk('the principal can change an event', r = 'ok' and (select start_time from school_day_blocks where title = 'General devotion') = '08:15');
  r := pg_temp.try_as(hod, $q$ update school_day_blocks set title = 'Hijacked' where title = 'General devotion' $q$);
  perform pg_temp.chk('a head of department cannot change one (the title is unchanged)', r = 'ok' and exists (select 1 from school_day_blocks where title = 'General devotion') and not exists (select 1 from school_day_blocks where title = 'Hijacked'));
  r := pg_temp.try_as(principal, $q$ delete from school_day_blocks where title = 'Sports day' $q$);
  perform pg_temp.chk('the principal can remove an event', r = 'ok' and not exists (select 1 from school_day_blocks where title = 'Sports day'));
end $$;

select n, case when ok then 'PASS' else 'FAIL' end as result, name from results order by n;
select count(*) filter (where not ok) as failed, count(*) as total from results;
