-- Tests for migration 085 (my_topic_lessons). Run AFTER student-topics seed.sql and 085 on a throwaway database. Last table: failed = 0.
create temp table results (name text, ok boolean, detail text);
create or replace function check_that(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;
create or replace function as_user(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true); set local role authenticated; end $$;
create or replace function lessons_for(p_uid uuid) returns jsonb language plpgsql as $$
declare r jsonb;
begin perform as_user(p_uid); r := public.my_topic_lessons(); reset role; return r; end $$;
create or replace function error_for(p_uid uuid) returns text language plpgsql as $$
declare r jsonb;
begin perform as_user(p_uid); begin r := public.my_topic_lessons(); reset role; return 'ok'; exception when others then reset role; return sqlstate; end; end $$;

-- fixture: two classes. Student One and Two are in 4-1; Student Three is in 4-2.
delete from learning_lessons; delete from enrollments; delete from class_groups;
insert into departments (id, name) values (u(201), 'Mathematics') on conflict do nothing;
insert into class_groups (id, name, year_grade, department_id) values (u(301), '4-1', '10', u(201)), (u(302), '4-2', '10', u(201));
insert into enrollments (student_id, class_group_id) values (u(101), u(301)), (u(102), u(301)), (u(103), u(302));
create or replace function steps_ok() returns jsonb language sql immutable as $$
  select jsonb_agg(jsonb_build_object('key', k, 'text', 'text', 'resources', '[]'::jsonb, 'approved', true))
    from unnest(array['engage','explore','explain','elaborate','evaluate']) k $$;
-- L1 published, Fractions, assigned to 4-1 (open)         L2 published, topic merged into Fractions, 4-1
-- L3 published, Fractions, 4-1 but due date passed and not kept open (closed)   L4 DRAFT, Fractions   L5 published, no topic, 4-1
-- L6 published, Algebra, assigned only to 4-2             L7 published, Fractions, 4-1, finished by Student One
insert into learning_lessons (id, teacher_id, title, subject, grade, topic_id, steps, status, published_at) values
  (u(1001), u(11), 'L1 Adding fractions',   'Mathematics', 10, u(701), steps_ok(), 'published', now()),
  (u(1002), u(11), 'L2 Old fractions',      'Mathematics', 10, u(703), steps_ok(), 'published', now()),
  (u(1003), u(11), 'L3 Closed lesson',      'Mathematics', 10, u(701), steps_ok(), 'published', now()),
  (u(1005), u(11), 'L5 No topic',           'Mathematics', 10, null,   steps_ok(), 'published', now()),
  (u(1006), u(11), 'L6 Algebra for 4-2',    'Mathematics', 10, u(702), steps_ok(), 'published', now()),
  (u(1007), u(11), 'L7 Finished lesson',    'Mathematics', 10, u(701), steps_ok(), 'published', now());
insert into learning_lessons (id, teacher_id, title, subject, grade, topic_id, status) values (u(1004), u(11), 'L4 Draft', 'Mathematics', 10, u(701), 'draft');
insert into learning_assignments (lesson_id, class_group_id, assigned_by, due_date, keep_open) values
  (u(1001), u(301), u(11), null, true), (u(1002), u(301), u(11), null, true),
  (u(1003), u(301), u(11), current_date - 30, false), (u(1005), u(301), u(11), null, true),
  (u(1006), u(302), u(11), null, true), (u(1007), u(301), u(11), null, true);
insert into learning_progress (lesson_id, student_id, completed_at) values (u(1007), u(101), now());

create temp table s1 as select lessons_for(u(101)) as j;
create temp table s3 as select lessons_for(u(103)) as j;
create temp table l1 as select e from s1, jsonb_array_elements(j) e;
create temp table l3 as select e from s3, jsonb_array_elements(j) e;

select check_that('Student One gets exactly the 3 open, tagged lessons for their class (L1, L2, L7)', (select count(*) from l1) = 3, (select string_agg(e ->> 'title', ', ') from l1));
select check_that('A merged-away topic is returned as the topic it became (Fractions)', (select e ->> 'topic_id' from l1 where e ->> 'title' like 'L2%') = u(701)::text);
select check_that('A lesson past its due date and not kept open is left out', not exists (select 1 from l1 where e ->> 'title' like 'L3%'));
select check_that('A draft lesson is left out', not exists (select 1 from l1 where e ->> 'title' like 'L4%'));
select check_that('A lesson with no topic is left out', not exists (select 1 from l1 where e ->> 'title' like 'L5%'));
select check_that('A lesson given only to another class is left out', not exists (select 1 from l1 where e ->> 'title' like 'L6%'));
select check_that('Finished lessons are marked done, others not', (select (e ->> 'done')::boolean from l1 where e ->> 'title' like 'L7%') and not (select bool_or((e ->> 'done')::boolean) from l1 where e ->> 'title' not like 'L7%'));
select check_that('Unfinished lessons come first', (select e ->> 'title' from s1, jsonb_array_elements(j) with ordinality t(e, o) order by o desc limit 1) like 'L7%');
select check_that('Student Three sees only their own class''s lesson (L6, Algebra)', (select count(*) from l3) = 1 and (select e ->> 'title' from l3) like 'L6%');
select check_that('Student Two, in the same class, gets the same 3 lessons but their own done flags (L7 not finished by them)', jsonb_array_length(lessons_for(u(102))) = 3 and not exists (select 1 from jsonb_array_elements(lessons_for(u(102))) e where (e ->> 'done')::boolean));
select check_that('Only id, title, subject, topic_id and done are returned (no lesson content, no other students)', (select bool_and(array(select jsonb_object_keys(e) order by 1) = array['done','id','subject','title','topic_id']) from l1));
select check_that('No lesson steps or text in the result', (select j::text from s1) !~* '"steps"|"text"');

select check_that('A teacher is refused', error_for(u(11)) = '42501');
select check_that('The principal is refused', error_for(u(2)) = '42501');
select check_that('The admin is refused', error_for(u(1)) = '42501');
select check_that('A signed-out caller cannot run it', not has_function_privilege('anon', 'public.my_topic_lessons()', 'execute'));
select check_that('Read-only function', (select provolatile from pg_proc where proname = 'my_topic_lessons') = 's');

select case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by ok, name;
select count(*) filter (where not ok) as failed, count(*) as total from results;
