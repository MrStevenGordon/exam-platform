-- Access checks for the weekly summary: each person reads only their own data through the queries the screens use. Run on a throwaway
-- database AFTER student-topics seed.sql (people u(1), u(2), u(11), u(101)-u(103)). Last table: failed = 0.
create temp table results (name text, ok boolean, detail text);
create or replace function check_that(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;
create or replace function as_user(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true); set local role authenticated; end $$;
create or replace function n_rows(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin perform as_user(p_uid); execute 'select count(*) from (' || p_sql || ') t' into n; reset role; return n; end $$;

delete from learning_lessons; delete from enrollments; delete from teacher_class_groups; delete from class_groups;
insert into departments (id, name) values (u(201), 'Mathematics') on conflict do nothing;
insert into auth.users (id, email) values (u(13), 'user13@test.local') on conflict do nothing;
insert into profiles (id, full_name, role, department_id, is_active) values (u(13), 'Other Teacher', 'teacher', u(201), true) on conflict do nothing;
insert into class_groups (id, name, year_grade, department_id) values (u(301), '4-1', '10', u(201)), (u(302), '4-2', '10', u(201));
insert into enrollments (student_id, class_group_id) values (u(101), u(301)), (u(102), u(301)), (u(103), u(302));
insert into teacher_class_groups (teacher_id, class_group_id) values (u(11), u(301));   -- Tina teaches 4-1; Other Teacher teaches nothing
insert into teacher_subjects (teacher_id, department_id, subject) values (u(11), u(201), 'Mathematics') on conflict do nothing;
create or replace function steps_ok() returns jsonb language sql immutable as $$
  select jsonb_agg(jsonb_build_object('key', k, 'text', 'text', 'resources', '[]'::jsonb, 'approved', true)) from unnest(array['engage','explore','explain','elaborate','evaluate']) k $$;
insert into learning_lessons (id, teacher_id, title, subject, grade, steps, status, published_at) values (u(1501), u(11), 'Tina lesson', 'Mathematics', 10, steps_ok(), 'published', now());
insert into learning_assignments (lesson_id, class_group_id, assigned_by, due_date, keep_open) values (u(1501), u(301), u(11), current_date + 2, true);
insert into learning_progress (lesson_id, student_id, completed_at) values (u(1501), u(101), now()), (u(1501), u(102), null);
insert into learning_check_questions (lesson_id, position, kind, prompt, options, correct_index) values (u(1501), 1, 'multiple_choice', 'Q', '["a","b"]', 0);
insert into learning_check_attempts (lesson_id, student_id, attempt_no, answers, results, score, max_score) values (u(1501), u(101), 1, '{}', '[]', 1, 1), (u(1501), u(102), 1, '{}', '[]', 0, 1);
insert into flashcard_decks (id, student_id, title) values (u(1601), u(101), 'S1 deck'), (u(1602), u(102), 'S2 deck');
insert into flashcards (deck_id, front, back, last_reviewed_at) values (u(1601), 'a', 'b', now()), (u(1602), 'c', 'd', now());

-- ============ a student ============
select check_that('Student One reads their released sessions (the seed has one on the class test and one on the final exam)', n_rows(u(101), 'select 1 from exam_sessions where student_id = ''' || u(101) || ''' and status = ''completed'' and results_released') = 2);
select check_that('Student One sees only their own check attempts', n_rows(u(101), 'select 1 from learning_check_attempts') = 1 and n_rows(u(101), 'select 1 from learning_check_attempts where student_id = ''' || u(102) || '''') = 0);
select check_that('Student One sees only their own flashcards', n_rows(u(101), 'select 1 from flashcards') = 1 and n_rows(u(101), 'select 1 from flashcard_decks where student_id <> ''' || u(101) || '''') = 0);
select check_that('Student One sees their own lesson progress and not Student Two''s', n_rows(u(101), 'select 1 from learning_progress where student_id = ''' || u(102) || '''') = 0);
select check_that('Student One reads their class enrolment and nobody else''s', n_rows(u(101), 'select 1 from enrollments') >= 1 and n_rows(u(101), 'select 1 from enrollments where student_id <> ''' || u(101) || '''') = 0);
select check_that('Student One gets exactly their class''s published lesson from the existing lessons function; Student Three (another class) gets none', n_rows(u(101), 'select * from public.learning_student_lessons()') = 1 and n_rows(u(103), 'select * from public.learning_student_lessons()') = 0);

-- ============ a teacher ============
select check_that('Tina reads her own class link', n_rows(u(11), 'select 1 from teacher_class_groups where teacher_id = ''' || u(11) || '''') = 1);
select check_that('Tina reads the enrolments of her class (2 students)', n_rows(u(11), 'select 1 from enrollments where class_group_id = ''' || u(301) || '''') = 2);
select check_that('Tina reads the names of her class', n_rows(u(11), 'select 1 from profiles where id in (''' || u(101) || ''', ''' || u(102) || ''')') = 2);
select check_that('Tina reads the sessions of her own students (student One has 2 completed sessions)', n_rows(u(11), 'select 1 from exam_sessions where student_id = ''' || u(101) || ''' and status = ''completed''') >= 1);
select check_that('Tina reads progress on the lesson she wrote (2 rows)', n_rows(u(11), 'select 1 from learning_progress where lesson_id = ''' || u(1501) || '''') = 2);
select check_that('Tina reads the assignments of her class', n_rows(u(11), 'select 1 from learning_assignments where class_group_id = ''' || u(301) || '''') = 1);
select check_that('Tina CANNOT read any student''s flashcards (private study material)', n_rows(u(11), 'select 1 from flashcards') = 0 and n_rows(u(11), 'select 1 from flashcard_decks') = 0);

-- ============ another teacher (no classes) ============
select check_that('Another teacher sees none of Tina''s class progress', n_rows(u(13), 'select 1 from learning_progress where lesson_id = ''' || u(1501) || '''') = 0);
select check_that('Another teacher sees no check attempts on Tina''s lesson', n_rows(u(13), 'select 1 from learning_check_attempts where lesson_id = ''' || u(1501) || '''') = 0);
select check_that('Another teacher sees none of Tina''s students'' exam sessions', n_rows(u(13), 'select 1 from exam_sessions where student_id in (''' || u(101) || ''', ''' || u(102) || ''') and status = ''completed''') = 0);
select check_that('Another teacher sees no flashcards', n_rows(u(13), 'select 1 from flashcards') = 0);

select case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by ok, name;
select count(*) filter (where not ok) as failed, count(*) as total from results;
