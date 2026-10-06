-- Speed check on the private test database: a school exam sat by 300 students (10 classes of 30) on 50 questions, with 5 earlier tests each.
-- Run after seed.sql. Prints how long the function takes for the head of department (all 300) and for one class teacher (30).
\set ON_ERROR_STOP on
insert into departments (id, name) values (u(290), 'PerfDept') on conflict do nothing;
insert into auth.users (id, email) select u(5000 + n), 'perf' || n || '@x.test' from generate_series(1, 301) n;
insert into profiles (id, full_name, role, department_id) values (u(5301), 'Perf Hod', 'supervisor', u(290));
update departments set head_id = u(5301) where id = u(290);
insert into profiles (id, full_name, role, student_id) select u(5000 + n), 'Perf Student ' || n, 'student', 'P' || n from generate_series(1, 300) n;
insert into auth.users (id, email) select u(5400 + c), 'perfteacher' || c || '@x.test' from generate_series(1, 10) c;
insert into profiles (id, full_name, role, department_id) select u(5400 + c), 'Perf Teacher ' || c, 'teacher', u(290) from generate_series(1, 10) c;
insert into class_groups (id, name, year_grade, department_id) select u(5500 + c), 'P' || c, '10', u(290) from generate_series(1, 10) c;
insert into enrollments (student_id, class_group_id) select u(5000 + n), u(5500 + ((n - 1) / 30) + 1) from generate_series(1, 300) n;
insert into teacher_class_groups (teacher_id, class_group_id) select u(5400 + c), u(5500 + c) from generate_series(1, 10) c;
insert into teacher_subjects (teacher_id, department_id, subject) select u(5400 + c), u(290), 'PerfMaths' from generate_series(1, 10) c;
insert into draft_exams (id, title, subject, created_by, status, department_id) values (u(5600), 'Perf source', 'PerfMaths', u(5301), 'published', u(290));
insert into final_exams (id, title, subject, created_by, status, duration_minutes, department_id) values (u(5601), 'Perf year exam', 'PerfMaths', u(5301), 'published', 60, u(290));
insert into final_exam_class_groups (final_exam_id, class_group_id) select u(5601), u(5500 + c) from generate_series(1, 10) c;
insert into questions (id, draft_exam_id, created_by, question_type, question_text, options, correct_answer, points, order_index)
  select u(6000 + n), u(5600), u(5301), 'multiple_choice', 'Perf question ' || n, '["A","B","C","D"]', 'A', 1, n from generate_series(1, 50) n;
insert into final_exam_questions (final_exam_id, question_id, order_index) select u(5601), u(6000 + n), n from generate_series(1, 50) n;
insert into exam_sessions (id, student_id, final_exam_id, status, started_at, completed_at, total_score, max_possible_score, fully_graded, assigned_teacher_id)
  select u(100000 + n), u(5000 + n), u(5601), 'completed', now() - interval '1 hour', now(), 25, 50, true, u(5400 + ((n - 1) / 30) + 1) from generate_series(1, 300) n;
insert into responses (session_id, question_id, answer, points_awarded)
  select u(100000 + n), u(6000 + q), (array['A','B','C','D'])[1 + (n * q) % 4], case when (n * q) % 4 = 0 then 1 else 0 end from generate_series(1, 300) n, generate_series(1, 50) q;
-- five earlier tests per student
insert into final_exams (id, title, subject, created_by, status, duration_minutes, department_id)
  select u(5700 + e), 'Perf earlier ' || e, 'PerfMaths', u(5301), 'published', 60, u(290) from generate_series(1, 5) e;
insert into exam_sessions (id, student_id, final_exam_id, status, started_at, completed_at, total_score, max_possible_score, fully_graded)
  select u(200000 + n * 10 + e), u(5000 + n), u(5700 + e), 'completed', now() - interval '30 days' - (e || ' days')::interval, now() - interval '29 days' - (e || ' days')::interval, 20 + (n % 25), 50, true
    from generate_series(1, 300) n, generate_series(1, 5) e;
analyze;
\timing on
select jsonb_array_length(run_as(u(5301), 'final', u(5601)) -> 'students') as students_for_hod;
select jsonb_array_length(run_as(u(5301), 'final', u(5601)) -> 'marks') as marks_for_hod;
select pg_size_pretty(length(run_as(u(5301), 'final', u(5601))::text)::bigint) as payload_for_hod;
select jsonb_array_length(run_as(u(5401), 'final', u(5601)) -> 'students') as students_for_class_teacher;
select jsonb_array_length(run_as(u(5301), 'final', u(5601)) -> 'history') as history_rows_for_hod;
