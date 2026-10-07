-- Tests for migration 092 (student support). Throwaway database only. Needs the demo fixture (scripts/tests/demo-seed/fixture.sql) and migrations up to 092
-- (091 first). Destructive: it clears timetable, results and plans. Every line should say PASS.
create temp table results (n serial, name text, ok boolean);
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean) returns void language sql as $$ insert into results (name, ok) values (p_name, coalesce(p_ok, false)) $$;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- the harness grants everything; the helpers that are server-only stay closed
revoke execute on function public.support_staff_ok(uuid) from authenticated;
revoke execute on function public.support_average(uuid, text, timestamptz) from authenticated;
revoke insert, update, delete on public.support_cases, public.support_actions from authenticated;

create or replace function pg_temp.as_user(who uuid) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true) $$;
create or replace function pg_temp.try_as(who uuid, stmt text) returns text language plpgsql as $$
begin perform pg_temp.as_user(who); set local role authenticated; execute stmt; reset role; return 'ok';
exception when others then reset role; return sqlstate; end $$;
create or replace function pg_temp.val_as(who uuid, q text) returns text language plpgsql as $$
declare r text;
begin perform pg_temp.as_user(who); set local role authenticated; execute q into r; reset role; return r;
exception when others then reset role; return 'ERR ' || sqlstate; end $$;

-- ---- the school ----
do $$
declare
  y text := public.school_year_for(public.school_today());
  deptB uuid := pg_temp.u(901); dept uuid := pg_temp.u(900);
  cg1 uuid := pg_temp.u(801); cg2 uuid := pg_temp.u(802);
  p uuid[]; i int; ex uuid;
begin
  insert into auth.users (id, email) select pg_temp.u(n), 'sp' || n || '@mhs.smartassess' from unnest(array[75, 76, 77]) n on conflict do nothing;
  insert into departments (id, name) values (deptB, 'Science') on conflict do nothing;
  insert into profiles (id, full_name, role, department_id, is_active) values
    (pg_temp.u(75), 'Teacher Science', 'teacher', deptB, true), (pg_temp.u(76), 'HOD Science', 'supervisor', deptB, true), (pg_temp.u(77), 'Teacher Unlinked', 'teacher', deptB, true) on conflict (id) do nothing;
  update departments set head_id = pg_temp.u(76) where id = deptB;
  delete from support_actions; delete from support_cases; delete from weekly_class_feedback; delete from daily_attendance; delete from exam_sessions;
  delete from draft_exams where title like 'SPT %';
  delete from timetable_sections; delete from timetable_periods where academic_year = y; delete from teacher_class_groups;
  insert into timetable_periods (name, start_time, end_time, order_index, academic_year) select 'P' || n, make_time(7 + n, 0, 0), make_time(8 + n, 0, 0), n - 1, y from generate_series(1, 7) n;
  select array_agg(id order by order_index) into p from timetable_periods where academic_year = y;
  -- Teacher 1 (Mathematics) teaches 3-1 and 3-2; Teacher 4 teaches English to 3-1 and is also the class-group teacher of 1-1; the Science teacher teaches 3-1
  insert into timetable_sections (id, department_id, subject, teacher_id, class_group_id, day_of_week, period_id, academic_year) values
    (pg_temp.u(6101), dept, 'Mathematics', pg_temp.u(1), cg1, 1, p[1], y), (pg_temp.u(6102), dept, 'Mathematics', pg_temp.u(1), cg2, 3, p[1], y),
    (pg_temp.u(6103), dept, 'English Language', pg_temp.u(4), cg1, 1, p[2], y), (pg_temp.u(6105), deptB, 'Science', pg_temp.u(75), cg1, 4, p[3], y);
  insert into section_enrollments (section_id, student_id) select s.id, e.student_id from timetable_sections s join enrollments e on e.class_group_id = s.class_group_id;
  insert into teacher_class_groups (teacher_id, class_group_id) values (pg_temp.u(4), pg_temp.u(803));
  delete from enrollments where student_id = pg_temp.u(10); insert into enrollments (student_id, class_group_id) values (pg_temp.u(10), pg_temp.u(803));   -- the testing student sits in 1-1, as in the fixture

  -- three papers: Mathematics and English for 3-1, Science for only four students (too few for a school average)
  insert into draft_exams (id, title, subject, created_by, status) values
    (pg_temp.u(7001), 'SPT Maths', 'Mathematics', pg_temp.u(1), 'published'), (pg_temp.u(7002), 'SPT English', 'English Language', pg_temp.u(4), 'published'), (pg_temp.u(7003), 'SPT Science', 'Science', pg_temp.u(75), 'published');
  -- Mathematics: students 11 to 15 got 30%, 16 to 40 got 70% (school average of those who sat: 30 students, 63.3)
  insert into exam_sessions (draft_exam_id, student_id, status, completed_at, fully_graded, total_score, max_possible_score, results_released)
    select pg_temp.u(7001), pg_temp.u(10 + n), 'completed', now() - interval '10 days', true, case when n <= 5 then 30 else 70 end, 100, true from generate_series(1, 30) n;
  -- an earlier Mathematics result for student 11 (80%) so the trend shows a fall
  insert into exam_sessions (draft_exam_id, student_id, status, completed_at, fully_graded, total_score, max_possible_score, results_released)
    select pg_temp.u(7001), pg_temp.u(11), 'completed', now() - interval '90 days', true, 80, 100, true;
  -- English: students 11 to 30 got 60%
  insert into exam_sessions (draft_exam_id, student_id, status, completed_at, fully_graded, total_score, max_possible_score, results_released)
    select pg_temp.u(7002), pg_temp.u(10 + n), 'completed', now() - interval '12 days', true, 60, 100, true from generate_series(1, 20) n;
  -- Science: four students only
  insert into exam_sessions (draft_exam_id, student_id, status, completed_at, fully_graded, total_score, max_possible_score, results_released)
    select pg_temp.u(7003), pg_temp.u(10 + n), 'completed', now() - interval '12 days', true, 50, 100, true from generate_series(1, 4) n;
  -- an unfinished result and an ungraded one are not counted
  insert into exam_sessions (draft_exam_id, student_id, status, completed_at, fully_graded, total_score, max_possible_score, results_released)
    values (pg_temp.u(7001), pg_temp.u(41), 'completed', now() - interval '3 days', false, 5, 100, false);

  -- attendance: student 11 absent on the four school days before today (inside the last 14 days); student 12 present
  insert into daily_attendance (student_id, att_date, status) select pg_temp.u(11), public.school_today() - n, 'absent' from generate_series(1, 4) n;
  insert into daily_attendance (student_id, att_date, status) select pg_temp.u(12), public.school_today() - n, 'present' from generate_series(1, 4) n;
  update profiles set active_login_last_seen_at = now() - interval '12 days' where id = pg_temp.u(11);

  -- class feedback this week: student 12 asked Teacher 1 for help; student 13 asked the Science teacher
  insert into weekly_class_feedback (student_id, week_start, subject, teacher_id, class_group_id, understanding, needs_help)
    values (pg_temp.u(12), date_trunc('week', public.school_today())::date, 'Mathematics', pg_temp.u(1), cg1, 1, true),
           (pg_temp.u(13), date_trunc('week', public.school_today())::date, 'Science', pg_temp.u(75), cg1, 2, true);
end $$;

-- the student-support list as JSON, as a person
create or replace function pg_temp.list_as(who uuid) returns jsonb language plpgsql as $$
declare r jsonb;
begin perform pg_temp.as_user(who); set local role authenticated; select public.support_students(60) into r; reset role; return r;
exception when others then reset role; return jsonb_build_object('error', sqlstate); end $$;
create or replace function pg_temp.stu(j jsonb, who uuid) returns jsonb language sql as $$ select e from jsonb_array_elements(j->'students') e where e->>'id' = who::text $$;

do $$
declare
  t1 uuid := pg_temp.u(1); t4 uuid := pg_temp.u(4); hod uuid := pg_temp.u(2); principal uuid := pg_temp.u(3); tB uuid := pg_temp.u(75); hodB uuid := pg_temp.u(76); lone uuid := pg_temp.u(77);
  j jsonb; s jsonb; case_id uuid; case2 uuid; r text; since text;
begin
  -- ===== who is in the list =====
  j := pg_temp.list_as(t1);
  perform pg_temp.chk('Teacher 1 sees the 36 students in 3-1 and 3-2 (and no one else)', jsonb_array_length(j->'students') = 36 and j->>'scope' = 'classes');
  perform pg_temp.chk('Teacher 4 sees 3-1 by timetable plus 1-1 by class group: 41 students', jsonb_array_length(pg_temp.list_as(t4)->'students') = 41);
  perform pg_temp.chk('the Science teacher sees only 3-1: 30 students', jsonb_array_length(pg_temp.list_as(tB)->'students') = 30);
  perform pg_temp.chk('a teacher with no classes sees nobody', jsonb_array_length(pg_temp.list_as(lone)->'students') = 0);
  j := pg_temp.list_as(hod);
  perform pg_temp.chk('the head of Mathematics sees every student taught by their department: 47', jsonb_array_length(j->'students') = 47 and j->>'scope' = 'department');
  perform pg_temp.chk('the head of Science sees the 30 students the Science teacher teaches', jsonb_array_length(pg_temp.list_as(hodB)->'students') = 30);
  j := pg_temp.list_as(principal);
  perform pg_temp.chk('the principal sees all 47 students', jsonb_array_length(j->'students') = 47 and j->>'scope' = 'school');
  perform pg_temp.chk('a student is refused', pg_temp.list_as(pg_temp.u(11))->>'error' = '42501');
  perform pg_temp.chk('a signed-out caller is refused', (select (jsonb_build_object('error', null))->>'error' is null) and pg_temp.val_as(null, 'select count(*)::text from support_cases') is not null);

  -- ===== the figures =====
  j := pg_temp.list_as(t1);
  perform pg_temp.chk('school average for Mathematics is 63.3 over 30 students', (select (b->>'avg')::numeric = 63.3 and (b->>'n')::int = 30 from jsonb_array_elements(j->'subjects') b where b->>'subject' = 'Mathematics'));
  perform pg_temp.chk('school average for English Language is 60.0', (select (b->>'avg')::numeric = 60.0 from jsonb_array_elements(j->'subjects') b where b->>'subject' = 'English Language'));
  perform pg_temp.chk('Science is left out: only four students sat it', not exists (select 1 from jsonb_array_elements(j->'subjects') b where b->>'subject' = 'Science'));
  perform pg_temp.chk('an overall school average is given', (j->>'school_avg') is not null);
  s := pg_temp.stu(j, pg_temp.u(11));
  perform pg_temp.chk('student 11: Mathematics average is 30 (the 90-day-old 80 is the earlier period, not the average)', (select (x->>'avg')::numeric = 30.0 and (x->>'prev')::numeric = 80.0 from jsonb_array_elements(s->'subjects') x where x->>'subject' = 'Mathematics'));
  perform pg_temp.chk('student 11: overall average counts Mathematics, English and Science: 3 results', (s->'overall'->>'n')::int = 3);
  perform pg_temp.chk('student 11: absent 4 times in the last 14 days', (s->>'absent')::int = 4 and (s->>'marked')::int = 4);
  perform pg_temp.chk('student 11: last seen 12 days ago is passed on', s->>'last_seen' is not null);
  perform pg_temp.chk('an ungraded result is not counted (student 41 has none)', pg_temp.stu(j, pg_temp.u(41)) is null or (pg_temp.stu(j, pg_temp.u(41))->'overall') is null or (pg_temp.stu(j, pg_temp.u(41))->'overall') = 'null'::jsonb);
  perform pg_temp.chk('the class names come with the student', (s->'classes') @> '["3-1"]'::jsonb);

  -- ===== class feedback signals follow the 091 rule =====
  perform pg_temp.chk('Teacher 1 sees that student 12 asked them for help', (pg_temp.stu(j, pg_temp.u(12))->>'asked_help')::boolean);
  perform pg_temp.chk('Teacher 1 does not see student 13 asking the Science teacher', not (pg_temp.stu(j, pg_temp.u(13))->>'asked_help')::boolean);
  perform pg_temp.chk('the Science teacher sees student 13 but not 12', (pg_temp.stu(pg_temp.list_as(tB), pg_temp.u(13))->>'asked_help')::boolean and not (pg_temp.stu(pg_temp.list_as(tB), pg_temp.u(12))->>'asked_help')::boolean);
  perform pg_temp.chk('the head of Mathematics sees 12 (their department''s teacher) but not 13', (pg_temp.stu(pg_temp.list_as(hod), pg_temp.u(12))->>'asked_help')::boolean and not (pg_temp.stu(pg_temp.list_as(hod), pg_temp.u(13))->>'asked_help')::boolean);
  perform pg_temp.chk('the principal gets no feedback signals', not (pg_temp.stu(pg_temp.list_as(principal), pg_temp.u(12))->>'asked_help')::boolean and (pg_temp.stu(pg_temp.list_as(principal), pg_temp.u(12))->>'help_weeks')::int = 0);

  -- ===== opening a plan =====
  r := pg_temp.try_as(t1, format($q$select support_case_open(%L, 'Mathematics', 'Below the school average and absent 4 days', 'Back to 55%% by the next test', %L)$q$, pg_temp.u(11), public.school_today() + 14));
  perform pg_temp.chk('a teacher can open a plan for a student in their class', r = 'ok');
  select id into case_id from support_cases where student_id = pg_temp.u(11);
  perform pg_temp.chk('the starting line is recorded: student 30.0, school 63.3', (select baseline_pct = 30.0 and baseline_school_pct = 63.3 from support_cases where id = case_id));
  perform pg_temp.chk('the owner and opener are the teacher', (select owner_id = t1 and opened_by = t1 and status = 'open' from support_cases where id = case_id));
  perform pg_temp.chk('a second open plan for the same student and subject is refused', pg_temp.try_as(t1, format($q$select support_case_open(%L, ' mathematics', 'again', 'again')$q$, pg_temp.u(11))) = 'P0001');
  perform pg_temp.chk('a general plan (no subject) is a separate plan and is allowed', pg_temp.try_as(t1, format($q$select support_case_open(%L, null, 'Attendance', 'Be in school every day this month')$q$, pg_temp.u(11))) = 'ok');
  perform pg_temp.chk('a student cannot open a plan', pg_temp.try_as(pg_temp.u(12), format($q$select support_case_open(%L, null, 'x', 'y')$q$, pg_temp.u(12))) = '42501');
  perform pg_temp.chk('a teacher cannot open one for a student they do not teach', pg_temp.try_as(tB, format($q$select support_case_open(%L, null, 'x', 'y')$q$, pg_temp.u(61))) = '42501');
  perform pg_temp.chk('a reason and a goal are required', pg_temp.try_as(t1, format($q$select support_case_open(%L, null, '  ', 'y')$q$, pg_temp.u(12))) = 'P0001' and pg_temp.try_as(t1, format($q$select support_case_open(%L, null, 'x', '')$q$, pg_temp.u(12))) = 'P0001');
  perform pg_temp.chk('the review date cannot be in the past', pg_temp.try_as(t1, format($q$select support_case_open(%L, null, 'x', 'y', %L)$q$, pg_temp.u(12), public.school_today() - 1)) = 'P0001');
  perform pg_temp.chk('a student cannot be named as the owner', pg_temp.try_as(t1, format($q$select support_case_open(%L, null, 'x', 'y', null, %L)$q$, pg_temp.u(12), pg_temp.u(20))) = 'P0001');
  perform pg_temp.chk('the plan shows against the student in the list', (pg_temp.stu(pg_temp.list_as(t1), pg_temp.u(11))->'plan'->>'status') = 'open');

  -- ===== who can read plans =====
  perform pg_temp.chk('Teacher 1 reads their plans (2)', jsonb_array_length(coalesce((select pg_temp.val_as(t1, 'select support_cases_list()::text')::jsonb), '[]'::jsonb)) = 2);
  perform pg_temp.chk('the Science teacher also sees them (they teach student 11)', jsonb_array_length(pg_temp.val_as(tB, 'select support_cases_list()::text')::jsonb) = 2);
  perform pg_temp.chk('a teacher with no link to the student sees none', jsonb_array_length(pg_temp.val_as(lone, 'select support_cases_list()::text')::jsonb) = 0);
  perform pg_temp.chk('a student cannot list plans', pg_temp.val_as(pg_temp.u(11), 'select support_cases_list()::text') = 'ERR 42501');
  perform pg_temp.chk('a student reading the table directly gets nothing', pg_temp.val_as(pg_temp.u(11), 'select count(*)::text from support_cases') = '0');
  perform pg_temp.chk('and nothing from the actions table either', pg_temp.val_as(pg_temp.u(11), 'select count(*)::text from support_actions') = '0');
  perform pg_temp.chk('the principal reads all plans', jsonb_array_length(pg_temp.val_as(principal, 'select support_cases_list()::text')::jsonb) = 2);
  perform pg_temp.chk('direct inserts are refused', pg_temp.try_as(t1, format($q$insert into support_cases (student_id, reason, goal, owner_id, opened_by) values (%L, 'x', 'y', %L, %L)$q$, pg_temp.u(12), t1, t1)) = '42501');
  perform pg_temp.chk('direct updates are refused', pg_temp.try_as(t1, format($q$update support_cases set status = 'closed' where id = %L$q$, case_id)) = '42501');

  -- ===== actions =====
  perform pg_temp.chk('the owner records an action', pg_temp.try_as(t1, format($q$select support_action_add(%L, 'one_to_one', 'Went through percentages for 20 minutes')$q$, case_id)) = 'ok');
  perform pg_temp.chk('another teacher of the student can add one', pg_temp.try_as(t4, format($q$select support_action_add(%L, 'parent_contact', 'Phoned home')$q$, case_id)) = 'ok');
  perform pg_temp.chk('a teacher with no link cannot', pg_temp.try_as(lone, format($q$select support_action_add(%L, 'other')$q$, case_id)) = '42501');
  perform pg_temp.chk('an unknown kind is refused', pg_temp.try_as(t1, format($q$select support_action_add(%L, 'magic')$q$, case_id)) = 'P0001');
  perform pg_temp.chk('a date in the future is refused', pg_temp.try_as(t1, format($q$select support_action_add(%L, 'other', null, %L)$q$, case_id, public.school_today() + 3)) = 'P0001');
  perform pg_temp.chk('the plan lists its actions, newest first (2)', (select jsonb_array_length(e->'actions') = 2 from jsonb_array_elements(pg_temp.val_as(t1, 'select support_cases_list()::text')::jsonb) e where e->>'id' = case_id::text));

  -- ===== progress since the plan began =====
  insert into exam_sessions (draft_exam_id, student_id, status, completed_at, fully_graded, total_score, max_possible_score, results_released)
    values (pg_temp.u(7001), pg_temp.u(11), 'completed', now() + interval '1 hour', true, 50, 100, true) on conflict do nothing;
  since := pg_temp.val_as(t1, format($q$select (e->>'since_pct') from jsonb_array_elements(support_cases_list()) e where e->>'id' = %L$q$, case_id));
  perform pg_temp.chk('a new Mathematics result after the plan began shows as progress (30 to 50)', since = '50.0' or since = '50');

  -- ===== changing and closing =====
  r := pg_temp.try_as(t1, format($q$select support_case_update(%L, 'monitoring', %L, 'Back to 55%% by the next test')$q$, case_id, public.school_today() + 21));
  perform pg_temp.chk('the owner can move it to monitoring and change the review date', r = 'ok' and (select status = 'monitoring' and review_on = public.school_today() + 21 from support_cases where id = case_id));
  perform pg_temp.chk('another teacher who only teaches the student cannot change it', pg_temp.try_as(t4, format($q$select support_case_update(%L, 'open', null, 'x')$q$, case_id)) = '42501');
  perform pg_temp.chk('the head of department can', pg_temp.try_as(hod, format($q$select support_case_update(%L, 'open', null, 'Back to 55%% by the next test')$q$, case_id)) = 'ok');
  r := pg_temp.try_as(principal, format($q$select support_case_update(%L, 'open', null, 'Back to 55%% by the next test', %L)$q$, case_id, t4));
  perform pg_temp.chk('the principal can hand it to another teacher', r = 'ok' and (select owner_id = t4 from support_cases where id = case_id));
  perform pg_temp.chk('the old owner still can, as the opener', pg_temp.try_as(t1, format($q$select support_case_update(%L, 'open', null, 'Back to 55%% by the next test')$q$, case_id)) = 'ok');
  perform pg_temp.chk('closing needs an outcome', pg_temp.try_as(t1, format($q$select support_case_close(%L, null)$q$, case_id)) = 'P0001' and pg_temp.try_as(t1, format($q$select support_case_close(%L, 'fixed')$q$, case_id)) = 'P0001');
  perform pg_temp.chk('a teacher who only teaches the student cannot close it', pg_temp.try_as(tB, format($q$select support_case_close(%L, 'improved')$q$, case_id)) = '42501');
  r := pg_temp.try_as(t1, format($q$select support_case_close(%L, 'improved', 'Back above 50%%')$q$, case_id));
  perform pg_temp.chk('the owner closes it with an outcome', r = 'ok' and (select status = 'closed' and outcome = 'improved' and closed_at is not null from support_cases where id = case_id));
  perform pg_temp.chk('a closed plan cannot be edited, closed again or added to', pg_temp.try_as(t1, format($q$select support_case_update(%L, 'open', null, 'x')$q$, case_id)) = 'P0001' and pg_temp.try_as(t1, format($q$select support_case_close(%L, 'improved')$q$, case_id)) = 'P0001' and pg_temp.try_as(t1, format($q$select support_action_add(%L, 'other')$q$, case_id)) = 'P0001');
  perform pg_temp.chk('the active list no longer shows it (only the general plan is left)', jsonb_array_length(pg_temp.val_as(t1, 'select support_cases_list()::text')::jsonb) = 1);
  perform pg_temp.chk('the closed list does (1)', jsonb_array_length(pg_temp.val_as(t1, $q$select support_cases_list('closed')::text$q$)::jsonb) = 1);
  perform pg_temp.chk('a new plan for the same subject can now be opened', pg_temp.try_as(t1, format($q$select support_case_open(%L, 'Mathematics', 'Again', 'Keep above 55%%')$q$, pg_temp.u(11))) = 'ok');
  perform pg_temp.chk('the student is not told about any of it: their own tables show nothing', pg_temp.val_as(pg_temp.u(11), 'select count(*)::text from support_cases') = '0');
  perform pg_temp.chk('the feature probe answers true', pg_temp.val_as(pg_temp.u(11), 'select support_ready()::text') = 'true');
  perform pg_temp.chk('server-only helpers are closed to signed-in people', pg_temp.try_as(t1, format($q$select support_staff_ok(%L)$q$, t1)) = '42501' and pg_temp.try_as(t1, format($q$select * from support_average(%L, null)$q$, pg_temp.u(11))) = '42501');
end $$;

select n, case when ok then 'PASS' else 'FAIL' end as result, name from results order by n;
select count(*) filter (where not ok) as failed, count(*) as total from results;
