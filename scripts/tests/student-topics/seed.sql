-- Fixture for the student topics tests (private test database only; never run this on a real school database).
truncate auth.users cascade;
create or replace function u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;

insert into auth.users (id, email) select u(n), 'user' || n || '@test.local' from unnest(array[1,2,11,12,101,102,103]) n;
insert into profiles (id, full_name, role, is_active) values
  (u(1),  'Ada Admin',     'admin',     true),
  (u(2),  'Pat Principal', 'principal', true),
  (u(11), 'Tina Teacher',  'teacher',   true),
  (u(12), 'Ivy Inactive',  'teacher',   false);
insert into profiles (id, full_name, role, student_id, is_active) values
  (u(101), 'Student One',   'student', 'S001', true),
  (u(102), 'Student Two',   'student', 'S002', true),
  (u(103), 'Student Three', 'student', 'S003', true);   -- sat nothing

-- topics: Fractions, Algebra, and "Old fractions" which was merged into Fractions
insert into curriculum_topics (id, code, subject, grade, name, status, merged_into) values
  (u(701), 'M-10-FRAC', 'Mathematics', 10, 'Fractions', 'active', null),
  (u(702), 'M-10-ALG',  'Mathematics', 10, 'Algebra',   'active', null),
  (u(703), 'M-10-OLDF', 'Mathematics', 10, 'Old fractions', 'archived', u(701));

-- D1: a released class test. Q1-Q4 Fractions (2 each), Q5 merged-away topic (2), Q6 free-text 'Percentages' (2), Q7 untagged (2), Q8 essay on Fractions (4)
insert into draft_exams (id, title, subject, created_by, status, pass_mark, direct_published, exam_kind) values
  (u(401), 'Class Test: Fractions', 'Mathematics', u(11), 'published', 50, true, 'class_test'),
  (u(402), 'English quiz (results NOT released)', 'English', u(11), 'published', 50, true, 'pop_quiz'),
  (u(403), 'Term exam source', 'Mathematics', u(11), 'published', 50, false, 'end_of_term');
insert into questions (id, draft_exam_id, created_by, question_type, question_text, options, correct_answer, points, order_index, topic_id, topic) values
  (u(501), u(401), u(11), 'multiple_choice', 'SECRET WORDING 1', '["A","B"]', 'A', 2, 1, u(701), null),
  (u(502), u(401), u(11), 'multiple_choice', 'SECRET WORDING 2', '["A","B"]', 'A', 2, 2, u(701), null),
  (u(503), u(401), u(11), 'multiple_choice', 'SECRET WORDING 3', '["A","B"]', 'A', 2, 3, u(701), null),
  (u(504), u(401), u(11), 'multiple_choice', 'SECRET WORDING 4', '["A","B"]', 'A', 2, 4, u(701), null),
  (u(505), u(401), u(11), 'multiple_choice', 'SECRET WORDING 5', '["A","B"]', 'A', 2, 5, u(703), null),
  (u(506), u(401), u(11), 'multiple_choice', 'SECRET WORDING 6', '["A","B"]', 'A', 2, 6, null, '  Percentages '),
  (u(507), u(401), u(11), 'multiple_choice', 'SECRET WORDING 7', '["A","B"]', 'A', 2, 7, null, null),
  (u(508), u(401), u(11), 'essay',           'SECRET WORDING 8', null, null, 4, 8, u(701), null),
  (u(511), u(402), u(11), 'multiple_choice', 'English Q1', '["A","B"]', 'A', 2, 1, u(702), null),
  (u(521), u(403), u(11), 'multiple_choice', 'Final exam Q1', '["A","B"]', 'A', 2, 1, u(702), null);
insert into final_exams (id, title, subject, created_by, status, duration_minutes, exam_category, pass_mark) values
  (u(601), 'Term 1 Mathematics', 'Mathematics', u(11), 'published', 60, 'end_of_term', 50);
insert into final_exam_questions (final_exam_id, question_id, order_index) values (u(601), u(521), 1);

-- sessions: (1) Student One, D1, released  (2) Student One, D2, NOT released  (3) Student One, final F1, released
--           (4) Student Two, D1, released   (5) Student One, D1 retake still in progress (must never count)
insert into exam_sessions (id, student_id, draft_exam_id, final_exam_id, status, started_at, completed_at, total_score, max_possible_score, fully_graded, results_released) values
  (u(801), u(101), u(401), null,    'completed',   now() - interval '40 days', now() - interval '40 days', 8, 20, false, true),
  (u(802), u(101), u(402), null,    'completed',   now() - interval '10 days', now() - interval '10 days', 2, 2,  true,  false),
  (u(803), u(101), null,    u(601), 'completed',   now() - interval '5 days',  now() - interval '5 days',  2, 2,  true,  true),
  (u(804), u(102), u(401), null,    'completed',   now() - interval '39 days', now() - interval '39 days', 20, 20, false, true),
  (u(805), u(101), u(401), null,    'in_progress', now() - interval '1 days',  null, null, null, false, true);
insert into responses (session_id, question_id, answer, points_awarded) values
  (u(801), u(501), 'A', 2), (u(801), u(502), 'A', 2), (u(801), u(503), 'B', 0), (u(801), u(504), 'A', 1), (u(801), u(505), 'A', 2),
  (u(801), u(506), 'A', 1), (u(801), u(507), 'A', 2), (u(801), u(508), 'a long essay', null),
  (u(802), u(511), 'A', 2),
  (u(803), u(521), 'A', 2),
  (u(804), u(501), 'A', 2), (u(804), u(502), 'A', 2), (u(804), u(503), 'A', 2), (u(804), u(504), 'A', 2), (u(804), u(505), 'A', 2),
  (u(804), u(506), 'A', 2), (u(804), u(507), 'A', 2), (u(804), u(508), 'essay', 4),
  (u(805), u(501), 'A', 0);
