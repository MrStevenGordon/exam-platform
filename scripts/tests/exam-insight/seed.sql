-- Fixture for the exam insight tests (private test database only; never run this on a real school database).
-- A small school: two departments, two Maths classes, teachers, HODs, a principal, an admin, and exams whose answers
-- are chosen so the expected numbers can be worked out by hand (see tests.sql).
truncate auth.users cascade;
create or replace function u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;

-- people (auth.users first: profiles.id references it)
insert into auth.users (id, email) select u(n), 'user' || n || '@test.local' from unnest(array[1,2,3,4,11,12,13,14]) n;
insert into auth.users (id, email) select u(100 + n), 'student' || n || '@test.local' from generate_series(1, 14) n;

insert into departments (id, name) values (u(201), 'Mathematics'), (u(202), 'Science');
insert into profiles (id, full_name, role, department_id, is_active) values
  (u(1),  'Ada Admin',      'admin',      null,    true),
  (u(2),  'Pat Principal',  'principal',  null,    true),
  (u(3),  'Hal Hodmath',    'supervisor', u(201),  true),
  (u(4),  'Sue Hodsci',     'supervisor', u(202),  true),
  (u(11), 'Tina Teacher1',  'teacher',    u(201),  true),
  (u(12), 'Tom Teacher2',   'teacher',    u(201),  true),
  (u(13), 'Sam Scienceteacher', 'teacher', u(202), true),
  (u(14), 'Ivy Inactive',   'teacher',    u(201),  false);
update departments set head_id = u(3) where id = u(201);
update departments set head_id = u(4) where id = u(202);
insert into profiles (id, full_name, role, student_id, is_active)
  select u(100 + n), 'Student ' || lpad(n::text, 2, '0'), 'student', 'S' || lpad(n::text, 3, '0'), n <> 13 from generate_series(1, 14) n;

insert into class_groups (id, name, year_grade, department_id) values (u(301), '4-2', '10', u(201)), (u(302), '4-3', '10', u(201));
insert into enrollments (student_id, class_group_id) select u(100 + n), u(301) from generate_series(1, 8) n;
insert into enrollments (student_id, class_group_id) select u(100 + n), u(302) from generate_series(9, 12) n;
insert into enrollments (student_id, class_group_id) values (u(113), u(301));  -- inactive student, must never be listed as "did not sit"
insert into teacher_subjects (teacher_id, department_id, subject) values (u(11), u(201), 'Mathematics'), (u(12), u(201), 'Mathematics'), (u(13), u(202), 'Science');
insert into teacher_class_groups (teacher_id, class_group_id) values (u(11), u(301)), (u(12), u(302));

-- ---------- exams ----------
-- D1: direct test by Teacher1, class 4-2. Questions 501-505.
insert into draft_exams (id, title, subject, created_by, status, department_id, pass_mark, direct_published, exam_kind) values
  (u(401), 'Class Test: Simple Interest', 'Mathematics', u(11), 'published', u(201), 50, true, 'class_test');
insert into draft_exam_class_groups (draft_exam_id, class_group_id) values (u(401), u(301));
insert into questions (id, draft_exam_id, created_by, question_type, question_text, options, correct_answer, points, order_index, topic) values
  (u(501), u(401), u(11), 'multiple_choice', 'Q1 simple interest on $5000 at 8% for 3 years', '["A","B","C","D"]', 'B', 1, 1, 'Simple interest'),
  (u(502), u(401), u(11), 'multiple_choice', 'Q2 convert 4% to a decimal',                    '["A","B","C","D"]', 'C', 1, 2, 'Percentages'),
  (u(503), u(401), u(11), 'true_false',      'Q3 rate is per year',                           null,                'True', 1, 3, 'Rate and time'),
  (u(504), u(401), u(11), 'essay',           'Q4 write the formula',                          null,                null, 4, 4, 'Simple interest'),
  (u(505), u(401), u(11), 'short_answer',    'Q5 total interest',                             null,                '1200', 2, 5, null);

-- Teacher2 sets a direct test of his own (D3) that some of Teacher1's students also sat, and one for 4-3 only (D2).
insert into draft_exams (id, title, subject, created_by, status, department_id, pass_mark, direct_published, exam_kind) values
  (u(410), 'Teacher2 quiz on ratios', 'Mathematics', u(12), 'published', u(201), 50, true, 'pop_quiz'),
  (u(411), 'Teacher2 4-3 test',       'Mathematics', u(12), 'published', u(201), 50, true, 'class_test');
insert into draft_exam_class_groups (draft_exam_id, class_group_id) values (u(410), u(301)), (u(411), u(302));
-- D0: an earlier direct test by Teacher1; E1: an English test (different subject, must never appear in history)
insert into draft_exams (id, title, subject, created_by, status, department_id, pass_mark, direct_published, exam_kind) values
  (u(405), 'Earlier fractions test', 'Mathematics', u(11), 'published', u(201), 50, true, 'class_test'),
  (u(406), 'English comprehension',  'English',     u(13), 'published', u(202), 50, true, 'class_test');
insert into draft_exam_class_groups (draft_exam_id, class_group_id) values (u(405), u(301)), (u(406), u(301));

-- F1: a school exam for both classes; its questions hang off a published draft (403). F0: an earlier school exam.
insert into draft_exams (id, title, subject, created_by, status, department_id, pass_mark, exam_kind) values
  (u(403), 'Term exam (source)', 'Mathematics', u(3), 'published', u(201), 50, 'end_of_term'),
  (u(404), 'Earlier term exam (source)', 'Mathematics', u(3), 'published', u(201), 50, 'monthly');
insert into final_exams (id, title, subject, created_by, status, duration_minutes, department_id, exam_category, pass_mark) values
  (u(402), 'Term 1 Mathematics Exam', 'Mathematics', u(3), 'published', 60, u(201), 'end_of_term', 50),
  (u(407), 'September Monthly',       'Mathematics', u(3), 'published', 60, u(201), 'monthly', 50);
insert into final_exam_class_groups (final_exam_id, class_group_id) values (u(402), u(301)), (u(402), u(302)), (u(407), u(301)), (u(407), u(302));
insert into questions (id, draft_exam_id, created_by, question_type, question_text, options, correct_answer, points, order_index) values
  (u(511), u(403), u(3), 'multiple_choice', 'F1 Q1', '["A","B","C","D"]', 'A', 2, 1),
  (u(512), u(403), u(3), 'multiple_choice', 'F1 Q2', '["A","B","C","D"]', 'D', 2, 2),
  (u(513), u(403), u(3), 'essay',           'F1 Q3', null, null, 6, 3),
  (u(521), u(404), u(3), 'multiple_choice', 'F0 Q1', '["A","B"]', 'A', 10, 1);
insert into final_exam_questions (final_exam_id, question_id, order_index) values (u(402), u(511), 1), (u(402), u(512), 2), (u(402), u(513), 3), (u(407), u(521), 1);

-- ---------- sessions ----------
-- helper: a completed session scoring `pts` of `mx`
create or replace function mk_session(p_id int, p_student int, p_draft int, p_final int, p_pts numeric, p_max numeric, p_when timestamptz, p_graded boolean default true, p_status text default 'completed', p_assigned int default null)
returns void language sql as $$
  insert into exam_sessions (id, student_id, draft_exam_id, final_exam_id, status, started_at, completed_at, total_score, max_possible_score, fully_graded, assigned_teacher_id)
  values (u(p_id), u(100 + p_student), case when p_draft is null then null else u(p_draft) end, case when p_final is null then null else u(p_final) end,
          p_status, p_when - interval '40 minutes', case when p_status = 'completed' then p_when end,
          case when p_status = 'completed' then p_pts end, case when p_status = 'completed' then p_max end, p_graded,
          case when p_assigned is null then null else u(p_assigned) end)
$$;

-- D1 sessions 601..607 for students 1..7 (student 8 never started); totals filled in below from the responses
insert into exam_sessions (id, student_id, draft_exam_id, status, started_at, completed_at, fully_graded)
  select u(600 + n), u(100 + n), u(401), 'completed', '2026-10-01 09:00+00'::timestamptz, '2026-10-01 09:40+00'::timestamptz, n <> 7 from generate_series(1, 7) n;

-- answers: columns are student, q1..q5 answer text, essay points (null = unmarked)
create temp table d1_answers (n int, a1 text, a2 text, a3 text, essay numeric, a5 text);
insert into d1_answers values
  (1, 'B', 'C', 'True',  4,    '1200'),
  (2, 'B', 'C', 'True',  3,    '1200'),
  (3, 'B', 'C', 'False', 2,    '400'),
  (4, 'A', 'C', 'True',  1,    '400'),
  (5, 'A', 'C', 'True',  0,    '400'),
  (6, 'A', 'D', 'True',  2,    ''),
  (7, 'B', 'A', 'True',  null, '1200');
insert into responses (session_id, question_id, answer, points_awarded)
  select u(600 + n), u(501), a1, case when a1 = 'B' then 1 else 0 end from d1_answers
  union all select u(600 + n), u(502), a2, case when a2 = 'C' then 1 else 0 end from d1_answers
  union all select u(600 + n), u(503), a3, case when a3 = 'True' then 1 else 0 end from d1_answers
  union all select u(600 + n), u(504), 'essay text ' || n, essay from d1_answers
  union all select u(600 + n), u(505), a5, case when a5 = '1200' then 2 else 0 end from d1_answers;
update exam_sessions s set total_score = x.t, max_possible_score = 9
  from (select session_id, sum(coalesce(points_awarded, 0)) t from responses where session_id between u(601) and u(607) group by session_id) x where s.id = x.session_id;

-- Earlier tests (history). D0 (Teacher1's) scores out of 10, F0 (school exam) out of 10, D3 (Teacher2's) out of 10, E1 (English) out of 10.
select mk_session(700 + n, n, 405, null, 9 - n, 10, '2026-09-01 10:00+00') from generate_series(1, 6) n;                -- D0: students 1..6 score 8,7,6,5,4,3
select mk_session(710 + n, n, null, 407, 10 - n, 10, '2026-09-15 10:00+00') from generate_series(1, 12) n;               -- F0: students 1..12 score 9,8,...
select mk_session(730 + n, n, 410, null, 5, 10, '2026-09-20 10:00+00') from generate_series(1, 3) n;                      -- D3: Teacher2's quiz, students 1..3 score 5
select mk_session(740 + n, n, 406, null, 10, 10, '2026-09-10 10:00+00') from generate_series(1, 3) n;                     -- E1: English, must be ignored
select mk_session(750 + n, 8 + n, 411, null, 7, 10, '2026-09-22 10:00+00') from generate_series(1, 4) n;                  -- D2: 4-3 test by Teacher2

-- F1 sessions: 4-2 students 1..6 completed (assigned to Teacher1), student 7 still sitting, 4-3 students 9..12 completed (assigned to Teacher2)
select mk_session(800 + n, n, null, 402, n + 2, 10, '2026-10-02 10:00+00', true, 'completed', 11) from generate_series(1, 6) n;
select mk_session(807, 7, null, 402, null, null, '2026-10-02 10:00+00', false, 'in_progress', 11);
select mk_session(808 + n - 8, n, null, 402, n - 4, 10, '2026-10-02 10:00+00', n <> 10, 'completed', 12) from generate_series(9, 12) n;
insert into responses (session_id, question_id, answer, points_awarded)
  select s.id, u(511), case when s.student_id <= u(104) then 'A' else 'B' end, case when s.student_id <= u(104) then 2 else 0 end
    from exam_sessions s where s.final_exam_id = u(402) and s.status = 'completed'
  union all
  select s.id, u(513), 'essay', case when s.student_id = u(110) then null else 3 end from exam_sessions s where s.final_exam_id = u(402) and s.status = 'completed';

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
