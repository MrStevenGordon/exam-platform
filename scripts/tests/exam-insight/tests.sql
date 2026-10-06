-- Access and content tests for exam_insight_data (migration 080). Run on the private test database after seed.sql.
-- Prints one PASS/FAIL line per check and a summary; exits non-zero (via a failed assertion) if anything failed.
-- (repeatable: removes the edge-case exams a previous run added)
delete from draft_exam_class_groups where draft_exam_id in (u(420), u(421));
delete from draft_exams where id in (u(420), u(421));
create temp table results (name text, ok boolean, detail text);
create or replace function check_that(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;

-- Calls the function as a signed-in person (their id in the token, the `authenticated` role, so row-level rules apply).
create or replace function run_as(p_uid uuid, p_kind text, p_exam uuid) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', case when p_uid is null then '{}' else jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  set local role authenticated;
  begin
    r := public.exam_insight_data(p_kind, p_exam);
  exception when others then
    reset role;
    return jsonb_build_object('error', sqlstate);
  end;
  reset role;
  return r;
end $$;

create or replace function student_nums(j jsonb) returns text[] language sql as $$
  select coalesce(array_agg(e ->> 'number' order by e ->> 'number'), '{}') from jsonb_array_elements(j -> 'students') e $$;
create or replace function hist_titles(j jsonb, p_idx int) returns text[] language sql as $$
  select coalesce(array_agg(h ->> 2 order by h ->> 4), '{}') from jsonb_array_elements(j -> 'history') h where (h ->> 0)::int = p_idx $$;

do $$
declare
  admin_ uuid := u(1); principal_ uuid := u(2); hodmath uuid := u(3); hodsci uuid := u(4);
  t1 uuid := u(11); t2 uuid := u(12); t3 uuid := u(13); inactive uuid := u(14); stu uuid := u(101);
  d1 uuid := u(401); d2 uuid := u(411); f1 uuid := u(402);
  j jsonb; j2 jsonb; i int;
begin
  -- ============ ACCESS: direct exam D1 (Teacher1's test, class 4-2) ============
  perform check_that('D1: admin may open',            run_as(admin_,    'direct', d1) ? 'exam');
  perform check_that('D1: principal may open',        run_as(principal_,'direct', d1) ? 'exam');
  perform check_that('D1: head of Maths may open',    run_as(hodmath,   'direct', d1) ? 'exam');
  perform check_that('D1: creator may open',          run_as(t1,        'direct', d1) ? 'exam');
  perform check_that('D1: other Maths teacher refused',   run_as(t2,     'direct', d1) ->> 'error' = '42501');
  perform check_that('D1: Science teacher refused',       run_as(t3,     'direct', d1) ->> 'error' = '42501');
  perform check_that('D1: head of Science refused',       run_as(hodsci, 'direct', d1) ->> 'error' = '42501');
  perform check_that('D1: student refused',               run_as(stu,    'direct', d1) ->> 'error' = '42501');
  perform check_that('D1: inactive teacher refused',      run_as(inactive,'direct', d1) ->> 'error' = '42501');
  perform check_that('D1: signed-out refused',            run_as(null,   'direct', d1) ->> 'error' = '42501');
  perform check_that('D1: unknown id -> not found',       run_as(admin_, 'direct', u(999)) ->> 'error' = 'P0002');
  perform check_that('D1: bad kind refused',              run_as(admin_, 'weird',  d1) ->> 'error' = '22023');
  perform check_that('D1: creator sees everything (sees_all)', (run_as(t1, 'direct', d1) -> 'exam' ->> 'sees_all')::boolean);
  -- a Maths teacher who did not write Teacher2's 4-3 test cannot read it; the head of Maths can
  perform check_that('D2: Teacher1 refused on Teacher2''s test', run_as(t1, 'direct', d2) ->> 'error' = '42501');
  perform check_that('D2: head of Maths may open',                run_as(hodmath, 'direct', d2) ? 'exam');

  -- ============ ACCESS: school exam F1 (both classes) ============
  perform check_that('F1: admin all',        (run_as(admin_,    'final', f1) -> 'exam' ->> 'sees_all')::boolean);
  perform check_that('F1: principal all',    (run_as(principal_,'final', f1) -> 'exam' ->> 'sees_all')::boolean);
  perform check_that('F1: head of Maths all',(run_as(hodmath,   'final', f1) -> 'exam' ->> 'sees_all')::boolean);
  perform check_that('F1: Teacher1 allowed, not all', run_as(t1, 'final', f1) ? 'exam' and not (run_as(t1, 'final', f1) -> 'exam' ->> 'sees_all')::boolean);
  perform check_that('F1: Teacher2 allowed, not all', run_as(t2, 'final', f1) ? 'exam' and not (run_as(t2, 'final', f1) -> 'exam' ->> 'sees_all')::boolean);
  perform check_that('F1: Science teacher refused',   run_as(t3,     'final', f1) ->> 'error' = '42501');
  perform check_that('F1: head of Science refused',   run_as(hodsci, 'final', f1) ->> 'error' = '42501');
  perform check_that('F1: student refused',           run_as(stu,    'final', f1) ->> 'error' = '42501');

  -- ============ CONTENT: D1 as its creator ============
  j := run_as(t1, 'direct', d1);
  perform check_that('D1: title and subject', j -> 'exam' ->> 'title' = 'Class Test: Simple Interest' and j -> 'exam' ->> 'subject' = 'Mathematics' and (j -> 'exam' ->> 'pass_mark')::int = 50);
  perform check_that('D1: class group named', j -> 'exam' -> 'classes' -> 0 ->> 'name' = '4-2');
  perform check_that('D1: eight students (7 sat + 1 did not start; inactive and unenrolled left out)', student_nums(j) = array['S001','S002','S003','S004','S005','S006','S007','S008'], student_nums(j)::text);
  perform check_that('D1: 7 completed', (select count(*) from jsonb_array_elements(j -> 'students') e where e ->> 'status' = 'completed') = 7);
  perform check_that('D1: 1 not started', (select count(*) from jsonb_array_elements(j -> 'students') e where e ->> 'status' = 'not_started') = 1);
  perform check_that('D1: student 7 not fully graded, others are', (select count(*) from jsonb_array_elements(j -> 'students') e where e ->> 'status' = 'completed' and (e ->> 'fully_graded')::boolean) = 6);
  perform check_that('D1: student 1 scored 9 of 9', (select (e ->> 'total')::numeric = 9 and (e ->> 'max')::numeric = 9 from jsonb_array_elements(j -> 'students') e where e ->> 'number' = 'S001'));
  perform check_that('D1: student 3 scored 4 of 9', (select (e ->> 'total')::numeric = 4 from jsonb_array_elements(j -> 'students') e where e ->> 'number' = 'S003'));
  perform check_that('D1: class name on the student', (select e ->> 'class' = '4-2' from jsonb_array_elements(j -> 'students') e where e ->> 'number' = 'S001'));
  perform check_that('D1: five questions in order', (select array_agg(e ->> 'text' order by o) from jsonb_array_elements(j -> 'questions') with ordinality t(e, o)) =
    array['Q1 simple interest on $5000 at 8% for 3 years','Q2 convert 4% to a decimal','Q3 rate is per year','Q4 write the formula','Q5 total interest']);
  perform check_that('D1: question types', (select array_agg(e ->> 'type' order by o) from jsonb_array_elements(j -> 'questions') with ordinality t(e, o)) = array['multiple_choice','multiple_choice','true_false','essay','short_answer']);
  perform check_that('D1: free-text topic carried through', j -> 'questions' -> 0 ->> 'topic_text' = 'Simple interest' and j -> 'questions' -> 4 -> 'topic_text' = 'null'::jsonb);
  perform check_that('D1: topics_available reported', (j -> 'exam' ->> 'topics_available')::boolean);
  perform check_that('D1: 35 marks rows (7 students x 5 questions)', jsonb_array_length(j -> 'marks') = 35);
  perform check_that('D1: exactly one unmarked answer (student 7 essay)', (select count(*) from jsonb_array_elements(j -> 'marks') m where m -> 2 = 'null'::jsonb) = 1);
  perform check_that('D1: answers kept only for choice questions', jsonb_array_length(j -> 'answers') = 3);
  perform check_that('D1: Q1 choices B=4 A=3', (j -> 'answers' -> 0 -> 'items' -> 0 ->> 'a') = 'B' and (j -> 'answers' -> 0 -> 'items' -> 0 ->> 'n')::int = 4 and (j -> 'answers' -> 0 -> 'items' -> 1 ->> 'a') = 'A' and (j -> 'answers' -> 0 -> 'items' -> 1 ->> 'n')::int = 3, (j -> 'answers' -> 0)::text);
  perform check_that('D1: Q2 choices C=5 then D and A one each', (j -> 'answers' -> 1 -> 'items' -> 0 ->> 'a') = 'C' and (j -> 'answers' -> 1 -> 'items' -> 0 ->> 'n')::int = 5 and jsonb_array_length(j -> 'answers' -> 1 -> 'items') = 3);
  perform check_that('D1: Q3 True=6 False=1', (j -> 'answers' -> 2 -> 'items' -> 0 ->> 'a') = 'True' and (j -> 'answers' -> 2 -> 'items' -> 0 ->> 'n')::int = 6);
  -- history: student 1 (index 0) has Teacher1's earlier test and the school exam, not Teacher2's quiz, not English
  i := (select (o - 1)::int from jsonb_array_elements(j -> 'students') with ordinality t(e, o) where e ->> 'number' = 'S001');
  perform check_that('D1 history, Teacher1: student 1 sees earlier fractions test + September monthly only', hist_titles(j, i) = array['Earlier fractions test', 'September Monthly'], hist_titles(j, i)::text);
  i := (select (o - 1)::int from jsonb_array_elements(j -> 'students') with ordinality t(e, o) where e ->> 'number' = 'S008');
  perform check_that('D1 history, Teacher1: student 8 has only the school exam', hist_titles(j, i) = array['September Monthly'], hist_titles(j, i)::text);
  perform check_that('D1 history never contains this exam itself', not exists (select 1 from jsonb_array_elements(j -> 'history') h where h ->> 1 = d1::text));
  -- the head of department can see Teacher2's quiz too
  j2 := run_as(hodmath, 'direct', d1);
  i := (select (o - 1)::int from jsonb_array_elements(j2 -> 'students') with ordinality t(e, o) where e ->> 'number' = 'S001');
  perform check_that('D1 history, head of Maths: also sees Teacher2''s quiz', hist_titles(j2, i) = array['Earlier fractions test', 'September Monthly', 'Teacher2 quiz on ratios'], hist_titles(j2, i)::text);
  perform check_that('D1 history never includes another subject', not exists (select 1 from jsonb_array_elements(j2 -> 'history') h where h ->> 2 = 'English comprehension'));

  -- ============ CONTENT: F1 (school exam) by role ============
  j := run_as(t1, 'final', f1);
  perform check_that('F1 Teacher1: sees only 4-2 students (S001..S008)', student_nums(j) = array['S001','S002','S003','S004','S005','S006','S007','S008'], student_nums(j)::text);
  perform check_that('F1 Teacher1: 6 completed, 1 in progress, 1 not started',
    (select count(*) filter (where e ->> 'status' = 'completed') = 6 and count(*) filter (where e ->> 'status' = 'in_progress') = 1 and count(*) filter (where e ->> 'status' = 'not_started') = 1 from jsonb_array_elements(j -> 'students') e));
  perform check_that('F1 Teacher1: 3 questions through the link table, in order', (select array_agg(e ->> 'text' order by o) from jsonb_array_elements(j -> 'questions') with ordinality t(e, o)) = array['F1 Q1','F1 Q2','F1 Q3']);
  perform check_that('F1 Teacher1: 12 marks rows (6 completed x 2 answered questions)', jsonb_array_length(j -> 'marks') = 12);
  j := run_as(t2, 'final', f1);
  perform check_that('F1 Teacher2: sees only 4-3 students (S009..S012)', student_nums(j) = array['S009','S010','S011','S012'], student_nums(j)::text);
  perform check_that('F1 Teacher2: 8 marks rows', jsonb_array_length(j -> 'marks') = 8);
  perform check_that('F1 Teacher2: one student fully graded false (essay unmarked)', (select count(*) from jsonb_array_elements(j -> 'students') e where not (e ->> 'fully_graded')::boolean) = 1);
  j := run_as(hodmath, 'final', f1);
  perform check_that('F1 head of Maths: all 12 enrolled students, inactive and unenrolled left out', jsonb_array_length(j -> 'students') = 12, jsonb_array_length(j -> 'students')::text);
  perform check_that('F1 head of Maths: 20 marks rows', jsonb_array_length(j -> 'marks') = 20);
  perform check_that('F1 principal sees the same as head of Maths', jsonb_array_length(run_as(principal_, 'final', f1) -> 'students') = 12 and jsonb_array_length(run_as(principal_, 'final', f1) -> 'marks') = 20);
  perform check_that('F1 history for Teacher1 on student 1: own earlier tests and the school exam, never Teacher2''s quiz',
    (select hist_titles(run_as(t1, 'final', f1), (o - 1)::int) = array['Earlier fractions test', 'September Monthly', 'Class Test: Simple Interest'] from jsonb_array_elements(run_as(t1, 'final', f1) -> 'students') with ordinality t(e, o) where e ->> 'number' = 'S001'));

  -- ============ EDGE CASES ============
  insert into draft_exams (id, title, subject, created_by, status, department_id, pass_mark, direct_published, exam_kind) values (u(420), 'Nobody sat this', 'Mathematics', u(11), 'published', u(201), 50, true, 'class_test');
  insert into draft_exam_class_groups values (gen_random_uuid(), u(420), u(301));
  j := run_as(t1, 'direct', u(420));
  perform check_that('Edge: nobody sat -> 8 not started, no marks, no answers', jsonb_array_length(j -> 'students') = 8 and jsonb_array_length(j -> 'marks') = 0 and jsonb_array_length(j -> 'answers') = 0 and jsonb_array_length(j -> 'questions') = 0);
  insert into draft_exams (id, title, subject, created_by, status, department_id, pass_mark, direct_published, exam_kind) values (u(421), 'No class set', 'Mathematics', u(11), 'published', u(201), 50, true, 'class_test');
  j := run_as(t1, 'direct', u(421));
  perform check_that('Edge: exam with no classes and no sessions -> empty but allowed for its creator', j ? 'exam' and jsonb_array_length(j -> 'students') = 0);
  perform check_that('Edge: a class teacher with nothing on a school exam is refused', run_as(t3, 'final', u(407)) ->> 'error' = '42501');
end $$;

-- ============ NO ONE GETS MORE THAN THEY CAN SEE TODAY ============
-- For each person the existing row-level rules apply to, every session the function returns must also be readable by them directly.
create or replace function visible_sessions_rls(p_uid uuid, p_kind text, p_exam uuid) returns uuid[] language plpgsql as $$
declare r uuid[];
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select coalesce(array_agg(student_id), '{}') into r from exam_sessions where (case when p_kind = 'direct' then draft_exam_id else final_exam_id end) = p_exam;
  reset role;
  return r;
end $$;

do $$
declare p record; e record; j jsonb; fn uuid[]; rls uuid[]; bad int := 0;
begin
  for p in select u(n) as id, n from unnest(array[1, 3, 4, 11, 12, 13]) n loop
    for e in select * from (values ('direct', u(401)), ('direct', u(410)), ('direct', u(411)), ('direct', u(405)), ('final', u(402)), ('final', u(407))) v(k, id) loop
      j := run_as(p.id, e.k, e.id);
      if j ? 'exam' then
        select coalesce(array_agg((s ->> 'id')::uuid), '{}') into fn from jsonb_array_elements(j -> 'students') s where s ->> 'status' <> 'not_started';
        rls := visible_sessions_rls(p.id, e.k, e.id);
        if exists (select 1 from unnest(fn) x where x <> all(rls)) then bad := bad + 1; raise notice 'LEAK: person % exam % %', p.n, e.k, e.id; end if;
      end if;
    end loop;
  end loop;
  perform check_that('Every returned session is one the person can already read (6 people x 6 exams)', bad = 0, bad::text);
end $$;

-- Teachers with no visible rows on an exam are refused, never shown an empty page that proves the exam exists.
select check_that('Refusal is the same error for "exists but not yours" as for "not a student of mine"', run_as(u(13), 'direct', u(401)) ->> 'error' = run_as(u(13), 'final', u(402)) ->> 'error');

-- ============ THE LIST OF EXAMS ============
create or replace function list_as(p_uid uuid) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', case when p_uid is null then '{}' else jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  set local role authenticated;
  begin r := public.exam_insight_list(); exception when others then reset role; return jsonb_build_object('error', sqlstate); end;
  reset role;
  return r;
end $$;
create or replace function list_titles(j jsonb) returns text[] language sql as $$
  select coalesce(array_agg(e ->> 'title' order by e ->> 'title'), '{}') from jsonb_array_elements(j) e $$;

select check_that('List, Teacher1: own tests and the school exams of the classes they teach',
  list_titles(list_as(u(11))) = array['Class Test: Simple Interest', 'Earlier fractions test', 'September Monthly', 'Term 1 Mathematics Exam'], list_titles(list_as(u(11)))::text);
select check_that('List, Teacher3 (Science): only their own English test', list_titles(list_as(u(13))) = array['English comprehension'], list_titles(list_as(u(13)))::text);
select check_that('List, head of Maths: the whole Maths department, not English',
  list_titles(list_as(u(3))) = array['Class Test: Simple Interest', 'Earlier fractions test', 'September Monthly', 'Teacher2 4-3 test', 'Teacher2 quiz on ratios', 'Term 1 Mathematics Exam'], list_titles(list_as(u(3)))::text);
select check_that('List, principal and admin: every exam with finished papers', jsonb_array_length(list_as(u(2))) = 7 and jsonb_array_length(list_as(u(1))) = 7, jsonb_array_length(list_as(u(2)))::text);
select check_that('List: student, inactive teacher and signed-out are refused', list_as(u(101)) ->> 'error' = '42501' and list_as(u(14)) ->> 'error' = '42501' and list_as(null) ->> 'error' = '42501');
select check_that('List: Teacher1 sees 6 finished papers on the September monthly, 7 on the class test',
  (select (e ->> 'sat')::int from jsonb_array_elements(list_as(u(11))) e where e ->> 'title' = 'Class Test: Simple Interest') = 7
  and (select (e ->> 'sat')::int from jsonb_array_elements(list_as(u(11))) e where e ->> 'title' = 'September Monthly') = 8);
select check_that('List: Teacher1 on the term exam sees only the 4-2 papers (6), the head of Maths sees all 10',
  (select (e ->> 'sat')::int from jsonb_array_elements(list_as(u(11))) e where e ->> 'title' = 'Term 1 Mathematics Exam') = 6
  and (select (e ->> 'sat')::int from jsonb_array_elements(list_as(u(3))) e where e ->> 'title' = 'Term 1 Mathematics Exam') = 10);
select check_that('List: every exam in a person''s list can actually be opened by them',
  (select bool_and(not (run_as(p.id, e ->> 'kind', (e ->> 'id')::uuid) ? 'error'))
     from (values (u(11)), (u(12)), (u(13)), (u(3)), (u(4)), (u(2)), (u(1))) p(id), jsonb_array_elements(list_as(p.id)) e));

select case when ok then 'PASS  ' else 'FAIL  ' end || name || case when ok then '' else '   <-- ' || coalesce(detail, '') end as result from results order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from results;
do $$ begin if exists (select 1 from results where not ok) then raise exception 'exam insight tests failed'; end if; end $$;
