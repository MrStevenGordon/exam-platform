-- Stand-in for the Manchester demo school, for the throwaway test database ONLY (never run on a real database).
-- Mimics the real shape: one Mathematics department, form classes 3-1..3-3, students whose student_id is NOT a 5-digit number,
-- and the four test accounts (Testing Teacher / HOD / Principal / Student 54321).
truncate auth.users cascade;
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;

insert into auth.users (id, email) select pg_temp.u(n), 'user' || n || '@mhs.smartassess' from generate_series(1, 90) n;
insert into departments (id, name) values (pg_temp.u(900), 'Mathematics');
insert into profiles (id, full_name, role, department_id, is_active) values
  (pg_temp.u(1), 'Testing Teacher',   'teacher',    pg_temp.u(900), true),
  (pg_temp.u(2), 'Testing HOD',       'supervisor', pg_temp.u(900), true),
  (pg_temp.u(3), 'Testing Principal', 'principal',  null,           true),
  (pg_temp.u(4), 'Jordan Real-Teacher', 'teacher',  pg_temp.u(900), true);
update departments set head_id = pg_temp.u(2) where id = pg_temp.u(900);
update profiles set leadership_title = 'Principal' where id = pg_temp.u(3);
insert into teacher_subjects (teacher_id, department_id, subject) values (pg_temp.u(1), pg_temp.u(900), 'Mathematics');

insert into class_groups (id, name, year_grade, department_id, academic_year) values
  (pg_temp.u(801), '3-1', 'Grade 9', pg_temp.u(900), '2026-2027'),
  (pg_temp.u(802), '3-2', 'Grade 9', pg_temp.u(900), '2026-2027'),
  (pg_temp.u(803), '1-1', 'Grade 7', pg_temp.u(900), '2026-2027');

-- 5 digit student id for the test student; the rest look like the placeholders on the real school
insert into profiles (id, full_name, role, student_id, grade_level, is_active) values (pg_temp.u(10), 'Testing Student', 'student', '54321', 7, true);
insert into profiles (id, full_name, role, student_id, grade_level, is_active)
  select pg_temp.u(10 + n), 'Student Number ' || n, 'student', '3-1-' || n, 9, true from generate_series(1, 36) n;
insert into profiles (id, full_name, role, student_id, grade_level, is_active)
  select pg_temp.u(60 + n), 'Younger Student ' || n, 'student', '1-1-' || n, 7, true from generate_series(1, 10) n;
-- the test student starts in a Grade 7 class, 3-1 holds 30 of the Grade 9s, 3-2 holds 6
insert into enrollments (student_id, class_group_id) select pg_temp.u(10), pg_temp.u(803);
insert into enrollments (student_id, class_group_id) select pg_temp.u(10 + n), pg_temp.u(801) from generate_series(1, 30) n;
insert into enrollments (student_id, class_group_id) select pg_temp.u(10 + n), pg_temp.u(802) from generate_series(31, 36) n;
insert into enrollments (student_id, class_group_id) select pg_temp.u(60 + n), pg_temp.u(803) from generate_series(1, 10) n;
