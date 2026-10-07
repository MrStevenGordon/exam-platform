-- Substitution with double periods (migration 089). Throwaway database; fixture + 088 + 089 applied. Every line should say PASS.
create temp table results (n serial, name text, ok boolean);
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean) returns void language sql as $$ insert into results (name, ok) values (p_name, coalesce(p_ok, false)) $$;
insert into auth.users (id, email) select pg_temp.u(n), 'x' || n || '@mhs.smartassess' from generate_series(95, 99) n on conflict do nothing;
insert into profiles (id, full_name, role, is_active) values (pg_temp.u(95), 'Ada Admin', 'admin', true) on conflict (id) do nothing;
insert into profiles (id, full_name, role, department_id, is_active) values
  (pg_temp.u(96), 'Teacher B (free in the morning)', 'teacher', pg_temp.u(900), true),
  (pg_temp.u(97), 'Teacher C (double in P2 and P3)',  'teacher', pg_temp.u(900), true),
  (pg_temp.u(98), 'Teacher D (single in P2)',         'teacher', pg_temp.u(900), true),
  (pg_temp.u(99), 'Teacher E (nothing at all)',       'teacher', pg_temp.u(900), true) on conflict (id) do update set full_name = excluded.full_name;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

insert into timetable_periods (id, name, start_time, end_time, order_index, academic_year) values
  (pg_temp.u(5001), 'P1', '08:00', '09:00', 0, '2099-2100'), (pg_temp.u(5002), 'P2', '09:00', '10:00', 1, '2099-2100'), (pg_temp.u(5003), 'P3', '10:00', '11:00', 2, '2099-2100');
-- Teacher A (Testing Teacher, u(1)): a double lesson P1+P2 on Monday with class 3-1.  C: double P2+P3.  D: single P2.  B: single P3.
insert into timetable_sections (id, department_id, subject, teacher_id, class_group_id, day_of_week, period_id, academic_year, span) values
  (pg_temp.u(6001), pg_temp.u(900), 'Mathematics', pg_temp.u(1),  pg_temp.u(801), 1, pg_temp.u(5001), '2099-2100', 2),
  (pg_temp.u(6002), pg_temp.u(900), 'Science',     pg_temp.u(97), pg_temp.u(802), 1, pg_temp.u(5002), '2099-2100', 2),
  (pg_temp.u(6003), pg_temp.u(900), 'Art',         pg_temp.u(98), pg_temp.u(803), 1, pg_temp.u(5002), '2099-2100', 1),
  (pg_temp.u(6004), pg_temp.u(900), 'Spanish',     pg_temp.u(96), pg_temp.u(803), 1, pg_temp.u(5003), '2099-2100', 1);

do $$
declare
  mon date := date_trunc('week', date '2099-10-07')::date;
  names text[];
begin
  perform pg_temp.chk('the test date is a Monday in the 2099-2100 school year', extract(isodow from mon) = 1 and public.school_year_for(mon) = '2099-2100');

  select array_agg(cand_name order by cand_name) into names from public.substitution_candidates(mon, pg_temp.u(5001), pg_temp.u(1), 2);
  perform pg_temp.chk('covering a double (P1+P2): the teacher free in both hours is offered', 'Teacher B (free in the morning)' = any(names));
  perform pg_temp.chk('covering a double: the teacher with nothing on is offered', 'Teacher E (nothing at all)' = any(names));
  perform pg_temp.chk('covering a double: a teacher busy in the SECOND hour with a single class is not offered', not ('Teacher D (single in P2)' = any(names)));
  perform pg_temp.chk('covering a double: a teacher busy in the second hour with their own double is not offered', not ('Teacher C (double in P2 and P3)' = any(names)));

  select array_agg(cand_name order by cand_name) into names from public.substitution_candidates(mon, pg_temp.u(5001), pg_temp.u(1), 1);
  perform pg_temp.chk('covering only the first hour (span 1): the teacher with a lesson from P2 is free', 'Teacher C (double in P2 and P3)' = any(names) and 'Teacher D (single in P2)' = any(names));

  select array_agg(cand_name order by cand_name) into names from public.substitution_candidates(mon, pg_temp.u(5003), pg_temp.u(1));
  perform pg_temp.chk('the old 3-argument call still works (default one period)', names is not null);
  perform pg_temp.chk('P3 is not free for the teacher whose double ends there', not ('Teacher C (double in P2 and P3)' = any(names)));
  perform pg_temp.chk('P3 is not free for the teacher teaching a single class in P3', not ('Teacher B (free in the morning)' = any(names)));

  -- an absence for only the second hour still includes the double lesson
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(95), 'role', 'authenticated')::text, true);
  set local role authenticated;
  select array_agg(subject) into names from public.substitution_teacher_sections(pg_temp.u(1), mon, mon, array[pg_temp.u(5002)]);
  reset role;
  perform pg_temp.chk('absent for the second hour only: the double lesson that includes it is listed', names = array['Mathematics']);
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(95), 'role', 'authenticated')::text, true);
  set local role authenticated;
  select array_agg(subject) into names from public.substitution_teacher_sections(pg_temp.u(1), mon, mon, array[pg_temp.u(5003)]);
  reset role;
  perform pg_temp.chk('absent for P3 only: the double (P1+P2) is not listed', names is null);
  select array_agg(subject) into names from public.substitution_teacher_sections(pg_temp.u(1), mon, mon, null);
end $$;

select n, case when ok then 'PASS' else 'FAIL' end as result, name from results order by n;
select count(*) filter (where not ok) as failed, count(*) as total from results;
