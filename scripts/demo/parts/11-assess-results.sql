-- ---- the HOD-vetted end-of-term exam (published to the class) and one exam waiting for the HOD ----
insert into draft_exams (id, title, subject, created_by, instructions, status, created_at, submitted_at, reviewed_by, reviewed_at, review_notes, department_id, exam_kind,
                         direct_published, duration_minutes, pass_mark, questions_per_page, target_grade, calculator_enabled, published_final_exam_id, available_from, available_until)
select pg_temp.did(1100), 'Term 1 Mathematics Examination', 'Mathematics', c.teacher, 'Answer all questions. Calculators are allowed.', 'published',
       (pg_temp.wk(24))::timestamptz, (pg_temp.wk(22))::timestamptz, c.hod, (pg_temp.wk(20))::timestamptz, 'Approved. Good spread of topics.', c.dept, 'end_of_term',
       false, 60, 50, 5, 9, true, null, (pg_temp.wk(14) + time '09:00') at time zone 'America/Jamaica', (pg_temp.wk(14) + time '16:00') at time zone 'America/Jamaica'
from demo_ctx c;
insert into final_exams (id, title, subject, instructions, created_by, status, duration_minutes, published_at, created_at, department_id, class_group_id, exam_category, pass_mark, questions_per_page, target_grade, calculator_enabled, available_from, available_until)
select pg_temp.did(1200), 'Term 1 Mathematics Examination', 'Mathematics', 'Answer all questions. Calculators are allowed.', c.teacher, 'published', 60,
       (pg_temp.wk(18))::timestamptz, (pg_temp.wk(20))::timestamptz, c.dept, c.class_id, 'end_of_term', 50, 5, 9, true,
       (pg_temp.wk(14) + time '09:00') at time zone 'America/Jamaica', (pg_temp.wk(14) + time '16:00') at time zone 'America/Jamaica'
from demo_ctx c;
update draft_exams set published_final_exam_id = pg_temp.did(1200) where id = pg_temp.did(1100);
insert into final_exam_class_groups (final_exam_id, class_group_id) select pg_temp.did(1200), class_id from demo_ctx;

-- 15 questions for the final, copied from the topics above, 2 marks each
create temp table demo_final_src (ord int, src_test int, src_ord int);
insert into demo_final_src values (1,1,1),(2,1,4),(3,2,2),(4,2,3),(5,2,7),(6,3,1),(7,3,2),(8,3,8),(9,4,1),(10,4,2),(11,4,6),(12,4,7),(13,4,10),(14,5,5),(15,5,7);
insert into questions (id, draft_exam_id, created_by, question_type, question_text, options, correct_answer, points, order_index, is_bank_question, topic_id, topic)
select pg_temp.did(3000 + f.ord), pg_temp.did(1100), q.created_by, q.question_type, q.question_text, q.options, q.correct_answer, 2, f.ord, false, q.topic_id, q.topic
from demo_final_src f join questions q on q.id = pg_temp.did(2000 + f.src_test * 100 + f.src_ord);
insert into final_exam_questions (final_exam_id, question_id, order_index) select pg_temp.did(1200), pg_temp.did(3000 + ord), ord from demo_final_src;

-- an exam the teacher has submitted and the HOD has not yet reviewed (so "vet and publish" can be shown live)
insert into draft_exams (id, title, subject, created_by, instructions, status, created_at, submitted_at, department_id, exam_kind, direct_published, duration_minutes, pass_mark, questions_per_page, target_grade, calculator_enabled)
select pg_temp.did(1300), 'Term 2 Mathematics Examination (draft for review)', 'Mathematics', c.teacher, 'Answer all questions.', 'submitted',
       (pg_temp.wk(3))::timestamptz, (pg_temp.wk(1))::timestamptz, c.dept, 'final_exam_submission', false, 60, 50, 5, 9, true
from demo_ctx c;
insert into questions (id, draft_exam_id, created_by, question_type, question_text, options, correct_answer, points, order_index, is_bank_question, topic_id, topic)
select pg_temp.did(3100 + f.ord), pg_temp.did(1300), q.created_by, q.question_type, q.question_text, q.options, q.correct_answer, 2, f.ord, false, q.topic_id, q.topic
from (values (1,2,5),(2,3,4),(3,4,4),(4,4,8),(5,5,4),(6,5,9)) as f(ord, src_test, src_ord)
join questions q on q.id = pg_temp.did(2000 + f.src_test * 100 + f.src_ord);

-- ---- students and how well each tends to do ----
create temp table demo_students as
select e.student_id as student, row_number() over (order by e.student_id) as idx,
       case when e.student_id = c.student then 0.50 else 0.38 + 0.52 * pg_temp.rnd(e.student_id::text) end as ability
from enrollments e cross join demo_ctx c where e.class_group_id = c.class_id;

-- ---- who sat what, when ----
create temp table demo_sit as
select s.student, s.idx, s.ability, t.test_no, null::int as final_no,
       pg_temp.did(5000 + t.test_no * 100 + s.idx::int) as session_id, pg_temp.did(1000 + t.test_no) as draft_id, null::uuid as final_id,
       (pg_temp.wk(t.days_ago) + time '10:15' + (s.idx * interval '20 seconds')) at time zone 'America/Jamaica' as started, t.duration, (t.test_no <= 4) as released
from demo_students s cross join demo_tests t cross join demo_ctx c
where s.student = c.student or pg_temp.rnd(s.student::text || t.test_no::text) > 0.07
union all
select s.student, s.idx, s.ability, null, 1, pg_temp.did(6000 + s.idx::int), null, pg_temp.did(1200),
       (pg_temp.wk(14) + time '09:20' + (s.idx * interval '25 seconds')) at time zone 'America/Jamaica', 60, true
from demo_students s cross join demo_ctx c
where s.student = c.student or pg_temp.rnd(s.student::text || 'final') > 0.05;

insert into exam_sessions (id, final_exam_id, draft_exam_id, student_id, status, started_at, completed_at, tab_switch_count, flagged, time_limit_seconds, results_released, option_shuffle_seed, password_verified, violation_log)
select x.session_id, x.final_id, x.draft_id, x.student, 'completed', x.started, x.started + (x.duration - 3 - floor(pg_temp.rnd(x.session_id::text) * 8)::int) * interval '1 minute',
       case when x.student <> c.student and pg_temp.rnd(x.session_id::text || 'tab') > 0.97 then 4 when x.student <> c.student and pg_temp.rnd(x.session_id::text || 'tab') > 0.92 then 1 else 0 end,
       (x.student <> c.student and pg_temp.rnd(x.session_id::text || 'tab') > 0.97),
       x.duration * 60, x.released, floor(pg_temp.rnd(x.session_id::text || 'seed') * 100000)::int, true, '[]'::jsonb
from demo_sit x cross join demo_ctx c;
update exam_sessions s set violation_log = (
  select jsonb_agg(jsonb_build_object('reason', 'Switched to another tab or window', 'timestamp', (s.started_at + (n * interval '4 minutes')), 'count', n)) from generate_series(1, s.tab_switch_count) n)
where pg_temp.is_demo(s.id) and s.tab_switch_count > 0;

-- ---- answers ----
create temp table demo_qinfo as
select pg_temp.did(2000 + q.test_no * 100 + q.ord) as question_id, q.wrong from demo_q q
union all
select pg_temp.did(3000 + f.ord), q.wrong from demo_final_src f join demo_q q on q.test_no = f.src_test and q.ord = f.src_ord;

create temp table demo_items as
select x.session_id, x.student, x.ability, q.id as question_id, q.question_type, q.options, q.correct_answer, q.points, q.order_index,
       coalesce(qi.wrong, '') as wrong, greatest(0.08, least(0.97, x.ability - coalesce(td.d, 0) + 0.14)) as p
from demo_sit x
join questions q on q.draft_exam_id = coalesce(x.draft_id, pg_temp.did(1100))
left join demo_qinfo qi on qi.question_id = q.id
left join curriculum_topics ct on ct.id = q.topic_id
left join demo_topic_d td on lower(td.topic) = lower(ct.name);

alter table demo_items add column is_right boolean, add column ans text;
update demo_items set is_right = pg_temp.rnd(session_id::text || question_id::text) < p where question_type <> 'essay';
update demo_items i set ans = case
    when question_type = 'essay' then null
    when is_right then correct_answer
    when question_type = 'short_answer' then (correct_answer::numeric + 10)::text
    when pg_temp.rnd(session_id::text || question_id::text || 'w') < 0.65 then wrong
    else coalesce((select o from jsonb_array_elements_text(i.options) o where o <> i.correct_answer and o <> i.wrong order by o limit 1), wrong)
  end;
