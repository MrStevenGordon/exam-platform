-- Tests for migration 091 (weekly class feedback). Throwaway database only. Needs the demo fixture (scripts/tests/demo-seed/fixture.sql)
-- and migrations up to 091. Every line should say PASS.
create temp table results (n serial, name text, ok boolean);
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean) returns void language sql as $$ insert into results (name, ok) values (p_name, coalesce(p_ok, false)) $$;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

create or replace function pg_temp.as_user(who uuid) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true) $$;
-- runs a statement as a person; returns 'ok' or the SQLSTATE
create or replace function pg_temp.try_as(who uuid, stmt text) returns text language plpgsql as $$
begin perform pg_temp.as_user(who); set local role authenticated; execute stmt; reset role; return 'ok';
exception when others then reset role; return sqlstate; end $$;
-- runs a query as a person and returns the first value as text
create or replace function pg_temp.val_as(who uuid, q text) returns text language plpgsql as $$
declare r text;
begin perform pg_temp.as_user(who); set local role authenticated; execute q into r; reset role; return r;
exception when others then reset role; return 'ERR ' || sqlstate; end $$;

create or replace function pg_temp.val_srv(q text) returns text language plpgsql as $$
declare r text;
begin set local role service_role; execute q into r; reset role; return r;
exception when others then reset role; return 'ERR ' || sqlstate; end $$;
-- the test harness grants everything to signed-in people; the server-only reminder pieces stay closed to them
revoke execute on function public.class_feedback_reminder_candidates(date) from authenticated;
revoke all on public.weekly_feedback_reminder_log from authenticated;

-- ---- the school: periods and classes for the current school year ----
do $$
declare
  y text := public.school_year_for(public.school_today());
  dept uuid := pg_temp.u(900); deptB uuid := pg_temp.u(901);
  cg1 uuid := pg_temp.u(801); cg2 uuid := pg_temp.u(802);
  sid uuid; p uuid[];
begin
  insert into auth.users (id, email) select pg_temp.u(n), 'fb' || n || '@mhs.smartassess' from unnest(array[75, 76]) n on conflict do nothing;
  insert into departments (id, name) values (deptB, 'Science') on conflict do nothing;
  insert into profiles (id, full_name, role, department_id, is_active) values
    (pg_temp.u(75), 'Teacher Science', 'teacher', deptB, true), (pg_temp.u(76), 'HOD Science', 'supervisor', deptB, true) on conflict (id) do nothing;
  update departments set head_id = pg_temp.u(76) where id = deptB;
  delete from timetable_sections; delete from timetable_periods where academic_year = y;
  insert into timetable_periods (name, start_time, end_time, order_index, academic_year) select 'P' || n, make_time(7 + n, 0, 0), make_time(8 + n, 0, 0), n - 1, y from generate_series(1, 7) n;
  select array_agg(id order by order_index) into p from timetable_periods where academic_year = y;
  -- Teacher 1 teaches Mathematics to 3-1 twice a week and to 3-2 once; Teacher 4 teaches English to 3-1; the Science teacher teaches 3-1 Science
  insert into timetable_sections (id, department_id, subject, teacher_id, class_group_id, day_of_week, period_id, academic_year) values
    (pg_temp.u(6101), dept, 'Mathematics', pg_temp.u(1), cg1, 1, p[1], y), (pg_temp.u(6102), dept, 'Mathematics', pg_temp.u(1), cg1, 2, p[1], y),
    (pg_temp.u(6103), dept, 'English Language', pg_temp.u(4), cg1, 1, p[2], y), (pg_temp.u(6104), dept, 'Mathematics', pg_temp.u(1), cg2, 3, p[1], y),
    (pg_temp.u(6105), deptB, 'Science', pg_temp.u(75), cg1, 4, p[3], y);
  insert into section_enrollments (section_id, student_id) select s.id, e.student_id from timetable_sections s join enrollments e on e.class_group_id = s.class_group_id;
  insert into curriculum_topics (id, code, subject, grade, name, status) values (pg_temp.u(950), 't1', 'Mathematics', 9, 'Simple interest', 'active'), (pg_temp.u(951), 't2', 'Mathematics', 9, 'Ratios', 'active') on conflict do nothing;
  delete from weekly_class_feedback; delete from weekly_class_reflections; delete from weekly_feedback_reminder_log;
end $$;

do $$
declare
  t1 uuid := pg_temp.u(1); t4 uuid := pg_temp.u(4); hod uuid := pg_temp.u(2); hodB uuid := pg_temp.u(76); principal uuid := pg_temp.u(3); tB uuid := pg_temp.u(75);
  this_week date := date_trunc('week', public.school_today())::date; last_week date := date_trunc('week', public.school_today())::date - 7;
  r text; n int; i int; v text;
begin
  -- ===== a student's own week =====
  perform pg_temp.chk('a student sees the subjects on their timetable, grouped by subject and teacher (Mathematics, English, Science)', pg_temp.val_as(pg_temp.u(11), 'select count(*)::text from class_feedback_my_week()') = '3');
  perform pg_temp.chk('Mathematics shows both of its lessons that week', pg_temp.val_as(pg_temp.u(11), $q$select lessons::text from class_feedback_my_week() where subject = 'Mathematics'$q$) = '2');
  perform pg_temp.chk('a student with no timetable sees nothing', pg_temp.val_as(pg_temp.u(60), 'select count(*)::text from class_feedback_my_week()') = '0');
  perform pg_temp.chk('before answering, nothing is marked as done', pg_temp.val_as(pg_temp.u(11), $q$select count(*) filter (where submitted)::text from class_feedback_my_week()$q$) = '0');

  -- ===== giving feedback =====
  r := pg_temp.try_as(pg_temp.u(11), format($q$select class_feedback_submit(%L, 'Mathematics', %L, 2, 3, 3, 4, 4, %L, true, 'The worked examples', 'Go slower')$q$, this_week, t1, pg_temp.u(950)));
  perform pg_temp.chk('a student can submit feedback for this week', r = 'ok');
  perform pg_temp.chk('it is saved with the class group', (select class_group_id from weekly_class_feedback where student_id = pg_temp.u(11)) = pg_temp.u(801));
  r := pg_temp.try_as(pg_temp.u(11), format($q$select class_feedback_submit(%L, 'mathematics ', %L, 4, 2, 4, 4, 4, null, false, '  ', null)$q$, this_week, t1));
  perform pg_temp.chk('submitting again changes the answer (any capital letters or spaces in the subject), it does not add a second row', r = 'ok' and (select count(*) from weekly_class_feedback where student_id = pg_temp.u(11)) = 1);
  perform pg_temp.chk('the change took: understanding 4, needs help cleared, blank comment is nothing', (select understanding = 4 and not needs_help and helped is null and hardest_topic_id is null from weekly_class_feedback where student_id = pg_temp.u(11)));
  perform pg_temp.chk('the form then shows the saved answer as done', pg_temp.val_as(pg_temp.u(11), $q$select (submitted and understanding = 4)::text from class_feedback_my_week() where subject = 'Mathematics'$q$) = 'true');
  perform pg_temp.chk('last week is still open', pg_temp.try_as(pg_temp.u(12), format($q$select class_feedback_submit(%L, 'Mathematics', %L, 3)$q$, last_week, t1)) = 'ok');
  perform pg_temp.chk('two weeks ago is closed', pg_temp.try_as(pg_temp.u(12), format($q$select class_feedback_submit(%L, 'Mathematics', %L, 3)$q$, this_week - 14, t1)) = 'P0001');
  perform pg_temp.chk('next week is not open yet', pg_temp.try_as(pg_temp.u(12), format($q$select class_feedback_submit(%L, 'Mathematics', %L, 3)$q$, this_week + 7, t1)) = 'P0001');
  perform pg_temp.chk('a class that is not on the timetable is refused', pg_temp.try_as(pg_temp.u(12), format($q$select class_feedback_submit(%L, 'Mathematics', %L, 3)$q$, this_week, tB)) = 'P0001');
  perform pg_temp.chk('the wrong subject for a real teacher is refused', pg_temp.try_as(pg_temp.u(12), format($q$select class_feedback_submit(%L, 'Science', %L, 3)$q$, this_week, t1)) = 'P0001');
  perform pg_temp.chk('a rating of 5 is refused', pg_temp.try_as(pg_temp.u(12), format($q$select class_feedback_submit(%L, 'Mathematics', %L, 5)$q$, this_week, t1)) = 'P0001');
  perform pg_temp.chk('understanding is required', pg_temp.try_as(pg_temp.u(12), format($q$select class_feedback_submit(%L, 'Mathematics', %L, null)$q$, this_week, t1)) = 'P0001');
  perform pg_temp.chk('a pace of 4 is refused', pg_temp.try_as(pg_temp.u(12), format($q$select class_feedback_submit(%L, 'Mathematics', %L, 3, 4)$q$, this_week, t1)) = 'P0001');
  perform pg_temp.chk('a comment over 500 characters is refused', pg_temp.try_as(pg_temp.u(12), format($q$select class_feedback_submit(%L, 'Mathematics', %L, 3, null, null, null, null, null, false, %L)$q$, this_week, t1, repeat('x', 501))) = 'P0001');
  perform pg_temp.chk('a topic that does not exist is refused', pg_temp.try_as(pg_temp.u(12), format($q$select class_feedback_submit(%L, 'Mathematics', %L, 3, null, null, null, null, %L)$q$, this_week, t1, pg_temp.u(999))) = 'P0001');
  perform pg_temp.chk('a teacher cannot submit student feedback', pg_temp.try_as(t1, format($q$select class_feedback_submit(%L, 'Mathematics', %L, 3)$q$, this_week, t1)) = '42501');
  r := pg_temp.try_as(pg_temp.u(13), format($q$select class_feedback_submit(%L, 'Mathematics', %L, 3)$q$, this_week + 2, t1));
  perform pg_temp.chk('a mid-week date is read as that week (Monday)', r = 'ok' and (select week_start from weekly_class_feedback where student_id = pg_temp.u(13) limit 1) = this_week);

  -- ===== students cannot read or write each other's answers =====
  perform pg_temp.chk('a student can read their own rows only', pg_temp.val_as(pg_temp.u(11), 'select count(*)::text from weekly_class_feedback') = '1');
  perform pg_temp.chk('a student cannot write the table directly', pg_temp.try_as(pg_temp.u(14), format($q$insert into weekly_class_feedback (student_id, week_start, subject, teacher_id, understanding) values (%L, %L, 'Mathematics', %L, 1)$q$, pg_temp.u(14), this_week, t1)) = '42501');
  perform pg_temp.chk('a student cannot change a row directly', (select understanding from weekly_class_feedback where student_id = pg_temp.u(11)) = 4 and pg_temp.val_as(pg_temp.u(11), 'with u as (update weekly_class_feedback set understanding = 1 returning 1) select count(*)::text from u') in ('0', 'ERR 42501'));
  perform pg_temp.chk('and it is still 4', (select understanding from weekly_class_feedback where student_id = pg_temp.u(11)) = 4);
  perform pg_temp.chk('teachers cannot read the table directly either', pg_temp.val_as(t1, 'select count(*)::text from weekly_class_feedback') = '0');
  perform pg_temp.chk('nor can the principal', pg_temp.val_as(principal, 'select count(*)::text from weekly_class_feedback') = '0');

  -- ===== the report =====
  -- 6 students answer for Mathematics 3-1 this week (u(11) already has understanding 4). Understandings: 4, 1, 2, 3, 4, 3 -> average 2.83. Pace: 1 slow, 4 right, 1 fast.
  delete from weekly_class_feedback;
  insert into weekly_class_feedback (student_id, week_start, subject, teacher_id, class_group_id, understanding, hardest_topic_id, needs_help, pace, engagement, clarity, support, helped, improve) values
    (pg_temp.u(11), this_week, 'Mathematics', t1, pg_temp.u(801), 4, null, false, 2, 4, 4, 4, 'Examples on the board', null),
    (pg_temp.u(12), this_week, 'Mathematics', t1, pg_temp.u(801), 1, pg_temp.u(950), true, 3, 2, 2, 1, null, 'Slow down please'),
    (pg_temp.u(13), this_week, 'Mathematics', t1, pg_temp.u(801), 2, pg_temp.u(950), false, 2, 3, 3, 3, 'Group work', 'More practice questions'),
    (pg_temp.u(14), this_week, 'Mathematics', t1, pg_temp.u(801), 3, pg_temp.u(951), false, 2, 3, 3, 3, null, null),
    (pg_temp.u(15), this_week, 'Mathematics', t1, pg_temp.u(801), 4, null, false, 1, 4, 4, 4, 'Quizzes', null),
    (pg_temp.u(16), this_week, 'Mathematics', t1, pg_temp.u(801), 3, null, false, 2, 3, 4, 3, null, 'Explain the steps again');
  -- 3 students answer for Mathematics 3-2 (under the threshold of 5)
  insert into weekly_class_feedback (student_id, week_start, subject, teacher_id, class_group_id, understanding, needs_help, pace, helped) values
    (pg_temp.u(41), this_week, 'Mathematics', t1, pg_temp.u(802), 1, true, 3, 'Nothing really'), (pg_temp.u(42), this_week, 'Mathematics', t1, pg_temp.u(802), 2, false, 3, 'Videos'), (pg_temp.u(43), this_week, 'Mathematics', t1, pg_temp.u(802), 4, false, 2, null);

  perform pg_temp.chk('the teacher gets a row for each of their classes (3-1 and 3-2) and nobody else''s', pg_temp.val_as(t1, format('select count(*)::text from class_feedback_report(%L, %L)', this_week, this_week)) = '2');
  perform pg_temp.chk('3-1: 6 answered of 30', pg_temp.val_as(t1, format($q$select responded || '/' || enrolled from class_feedback_report(%L, %L) where class_name = '3-1'$q$, this_week, this_week)) = '6/30');
  perform pg_temp.chk('3-1: understanding averages 2.83', pg_temp.val_as(t1, format($q$select understanding_avg::text from class_feedback_report(%L, %L) where class_name = '3-1'$q$, this_week, this_week)) = '2.83');
  perform pg_temp.chk('3-1: pace counts are 1, 4 and 1', pg_temp.val_as(t1, format($q$select (pace->>'too_slow') || (pace->>'just_right') || (pace->>'too_fast') from class_feedback_report(%L, %L) where class_name = '3-1'$q$, this_week, this_week)) = '141');
  perform pg_temp.chk('3-1: the anonymous comments arrive (without any student id)', pg_temp.val_as(t1, format($q$select (jsonb_array_length(helped) = 3 and jsonb_array_length(improve) = 3 and helped::text not like '%%0000%%')::text from class_feedback_report(%L, %L) where class_name = '3-1'$q$, this_week, this_week)) = 'true');
  perform pg_temp.chk('3-1: the hardest topics are counted (Simple interest twice, Ratios once)', pg_temp.val_as(t1, format($q$select (hardest_topics->0->>'topic') || (hardest_topics->0->>'count') || (hardest_topics->1->>'topic') from class_feedback_report(%L, %L) where class_name = '3-1'$q$, this_week, this_week)) = 'Simple interest2Ratios');
  perform pg_temp.chk('3-1: the teacher is told who needs attention, with names (understanding 2 or less, or asked for help)', pg_temp.val_as(t1, format($q$select jsonb_array_length(needs_attention)::text from class_feedback_report(%L, %L) where class_name = '3-1'$q$, this_week, this_week)) = '2');
  perform pg_temp.chk('the first one is the student who understood least, by name', pg_temp.val_as(t1, format($q$select needs_attention->0->>'name' from class_feedback_report(%L, %L) where class_name = '3-1'$q$, this_week, this_week)) = (select full_name from profiles where id = pg_temp.u(12)));
  perform pg_temp.chk('3-2 (3 answers): the teacher sees the understanding and the named list', pg_temp.val_as(t1, format($q$select understanding_avg::text || ',' || jsonb_array_length(needs_attention) from class_feedback_report(%L, %L) where class_name = '3-2'$q$, this_week, this_week)) = '2.33,2');
  perform pg_temp.chk('3-2: but the anonymous parts stay hidden until 5 have answered (pace, comments, clarity)', pg_temp.val_as(t1, format($q$select (pace is null and helped is null and clarity_avg is null and engagement_avg is null)::text from class_feedback_report(%L, %L) where class_name = '3-2'$q$, this_week, this_week)) = 'true');
  perform pg_temp.chk('the principal sees every class', pg_temp.val_as(principal, format('select count(*)::text from class_feedback_report(%L, %L)', this_week, this_week)) = '4');
  perform pg_temp.chk('the principal sees 3-1 figures and comments', pg_temp.val_as(principal, format($q$select (understanding_avg = 2.83 and jsonb_array_length(helped) = 3)::text from class_feedback_report(%L, %L) where class_name = '3-1' and subject = 'Mathematics'$q$, this_week, this_week)) = 'true');
  perform pg_temp.chk('the principal never sees names', pg_temp.val_as(principal, format($q$select count(needs_attention)::text from class_feedback_report(%L, %L)$q$, this_week, this_week)) = '0');
  perform pg_temp.chk('the principal sees nothing about 3-2 under the threshold (hidden)', pg_temp.val_as(principal, format($q$select (hidden and understanding_avg is null and hardest_topics is null)::text from class_feedback_report(%L, %L) where class_name = '3-2'$q$, this_week, this_week)) = 'true');
  perform pg_temp.chk('the head of Mathematics sees the department''s classes (3 Mathematics and English), not Science', pg_temp.val_as(hod, format($q$select count(*)::text from class_feedback_report(%L, %L)$q$, this_week, this_week)) = '3');
  perform pg_temp.chk('the head of Mathematics sees names for those classes', pg_temp.val_as(hod, format($q$select jsonb_array_length(needs_attention)::text from class_feedback_report(%L, %L) where class_name = '3-1' and subject = 'Mathematics'$q$, this_week, this_week)) = '2');
  perform pg_temp.chk('the head of Science sees only the Science class', pg_temp.val_as(hodB, format($q$select string_agg(subject, ',') from class_feedback_report(%L, %L)$q$, this_week, this_week)) = 'Science');
  perform pg_temp.chk('another teacher (English) sees only their own class', pg_temp.val_as(t4, format($q$select string_agg(subject, ',') from class_feedback_report(%L, %L)$q$, this_week, this_week)) = 'English Language');
  perform pg_temp.chk('that teacher sees none of the Mathematics answers', pg_temp.val_as(t4, format($q$select coalesce(sum(responded), 0)::text from class_feedback_report(%L, %L)$q$, this_week, this_week)) = '0');
  perform pg_temp.chk('a student cannot ask for the report', pg_temp.val_as(pg_temp.u(11), format('select count(*)::text from class_feedback_report(%L, %L)', this_week, this_week)) = 'ERR 42501');
  perform pg_temp.chk('the report covers several weeks (a row per class per week)', pg_temp.val_as(t1, format('select count(*)::text from class_feedback_report(%L, %L)', this_week - 14, this_week)) = '6');
  perform pg_temp.chk('more than twelve weeks is refused', pg_temp.val_as(t1, format('select count(*)::text from class_feedback_report(%L, %L)', this_week - 7 * 20, this_week)) = 'ERR P0001');

  -- ===== teacher reflections =====
  perform pg_temp.chk('a teacher can write a reflection for this week for their own class', pg_temp.try_as(t1, format($q$insert into weekly_class_reflections (teacher_id, week_start, subject, class_group_id, pace_vs_plan, covered, went_well) values (%L, %L, 'Mathematics', %L, 'behind', 'Simple interest', 'Good discussion')$q$, t1, this_week, pg_temp.u(801))) = 'ok');
  perform pg_temp.chk('not for a class they do not teach', pg_temp.try_as(t1, format($q$insert into weekly_class_reflections (teacher_id, week_start, subject, class_group_id) values (%L, %L, 'English Language', %L)$q$, t1, this_week, pg_temp.u(801))) = 'P0001');
  perform pg_temp.chk('not for three weeks ago', pg_temp.try_as(t1, format($q$insert into weekly_class_reflections (teacher_id, week_start, subject, class_group_id) values (%L, %L, 'Mathematics', %L)$q$, t1, this_week - 21, pg_temp.u(801))) = 'P0001');
  perform pg_temp.chk('one reflection per class per week', pg_temp.try_as(t1, format($q$insert into weekly_class_reflections (teacher_id, week_start, subject, class_group_id) values (%L, %L, 'Mathematics', %L)$q$, t1, this_week, pg_temp.u(801))) = '23505');
  perform pg_temp.chk('a teacher cannot write one in another teacher''s name', pg_temp.try_as(t4, format($q$insert into weekly_class_reflections (teacher_id, week_start, subject, class_group_id) values (%L, %L, 'Mathematics', %L)$q$, t1, last_week, pg_temp.u(801))) = '42501');
  perform pg_temp.chk('a student cannot write one', pg_temp.try_as(pg_temp.u(11), format($q$insert into weekly_class_reflections (teacher_id, week_start, subject, class_group_id) values (%L, %L, 'Mathematics', %L)$q$, t1, this_week, pg_temp.u(801))) = '42501');
  r := pg_temp.try_as(t1, format($q$update weekly_class_reflections set next_steps = 'Reteach ratios' where teacher_id = %L$q$, t1));
  perform pg_temp.chk('the teacher can edit their reflection', r = 'ok' and (select next_steps from weekly_class_reflections limit 1) = 'Reteach ratios');
  perform pg_temp.chk('but cannot move it to another week', pg_temp.try_as(t1, format($q$update weekly_class_reflections set week_start = %L where teacher_id = %L$q$, last_week, t1)) = 'P0001');
  perform pg_temp.chk('another teacher cannot read it', pg_temp.val_as(t4, 'select count(*)::text from weekly_class_reflections') = '0');
  perform pg_temp.chk('a student cannot read it', pg_temp.val_as(pg_temp.u(11), 'select count(*)::text from weekly_class_reflections') = '0');
  perform pg_temp.chk('the head of Mathematics can read it', pg_temp.val_as(hod, 'select count(*)::text from weekly_class_reflections') = '1');
  perform pg_temp.chk('the head of Science cannot', pg_temp.val_as(hodB, 'select count(*)::text from weekly_class_reflections') = '0');
  perform pg_temp.chk('the principal can read it', pg_temp.val_as(principal, 'select count(*)::text from weekly_class_reflections') = '1');
  perform pg_temp.chk('the report shows the reflection beside the class figures (pace vs plan: behind)', pg_temp.val_as(t1, format($q$select reflection->>'pace_vs_plan' from class_feedback_report(%L, %L) where class_name = '3-1'$q$, this_week, this_week)) = 'behind');
  perform pg_temp.chk('and the principal sees it too', pg_temp.val_as(principal, format($q$select reflection->>'covered' from class_feedback_report(%L, %L) where class_name = '3-1' and subject = 'Mathematics'$q$, this_week, this_week)) = 'Simple interest');

  -- ===== reminders =====
  perform pg_temp.chk('status for a student: 3 classes, 1 done', pg_temp.val_as(pg_temp.u(11), $q$select (class_feedback_status()->>'classes') || '/' || (class_feedback_status()->>'done')$q$) = '3/1');
  perform pg_temp.chk('status for a teacher: 2 classes, 1 reflection, 9 responses', pg_temp.val_as(t1, $q$select (class_feedback_status()->>'classes') || '/' || (class_feedback_status()->>'done') || '/' || (class_feedback_status()->>'responses')$q$) = '2/1/9');
  perform pg_temp.chk('status for the principal is nothing', pg_temp.val_as(principal, $q$select coalesce(class_feedback_status()::text, 'none')$q$) = 'none');
  perform pg_temp.chk('the feature probe answers true', pg_temp.val_as(pg_temp.u(11), 'select class_feedback_ready()::text') = 'true');
  -- ===== Friday reminder (server only) =====
  perform pg_temp.chk('a signed-in teacher cannot call the reminder list', pg_temp.try_as(t1, 'select * from class_feedback_reminder_candidates()') = '42501');
  perform pg_temp.chk('nor can a student', pg_temp.try_as(pg_temp.u(11), 'select * from class_feedback_reminder_candidates()') = '42501');
  perform pg_temp.chk('the server sees a teacher who still has a class without a reflection', pg_temp.val_srv(format($q$select count(*)::text from class_feedback_reminder_candidates(%L) where teacher_id = %L$q$, this_week, t1)) = '1');
  perform pg_temp.chk('the list names every class, with reflections marked (Maths 3-1 done, 3-2 not)',
    pg_temp.val_srv(format($q$select ((classes @> '[{"class_name":"3-1","reflected":true}]'::jsonb) and (classes @> '[{"class_name":"3-2","reflected":false}]'::jsonb))::text from class_feedback_reminder_candidates(%L) where teacher_id = %L$q$, this_week, t1)) = 'true');
  perform pg_temp.chk('a teacher with no reflection yet is listed', pg_temp.val_srv(format($q$select count(*)::text from class_feedback_reminder_candidates(%L) where teacher_id = %L$q$, this_week, t4)) = '1');
  insert into weekly_class_reflections (teacher_id, week_start, subject, class_group_id) values (t1, this_week, 'Mathematics', pg_temp.u(802));
  perform pg_temp.chk('once every class has a reflection the teacher is no longer listed', pg_temp.val_srv(format($q$select count(*)::text from class_feedback_reminder_candidates(%L) where teacher_id = %L$q$, this_week, t1)) = '0');
  insert into weekly_feedback_reminder_log (teacher_id, week_start) values (t4, this_week);
  perform pg_temp.chk('a teacher already reminded this week is not listed again', pg_temp.val_srv(format($q$select count(*)::text from class_feedback_reminder_candidates(%L) where teacher_id = %L$q$, this_week, t4)) = '0');
  perform pg_temp.chk('the reminder log cannot be read by a signed-in person', pg_temp.val_as(t1, 'select count(*)::text from weekly_feedback_reminder_log') = 'ERR 42501');
end $$;

select n, case when ok then 'PASS' else 'FAIL' end as result, name from results order by n;
select count(*) filter (where not ok) as failed, count(*) as total from results;
