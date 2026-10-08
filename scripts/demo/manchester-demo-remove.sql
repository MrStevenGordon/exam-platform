begin;
-- Removes everything an earlier run of the Manchester demo seed added (rows whose id starts with dd000000-).
-- It does NOT undo: moving Testing Student into the demo class and setting them to Grade 9, or the Testing Teacher's class link.
create or replace function pg_temp.is_demo(u uuid) returns boolean language sql immutable as $$ select u::text like 'dd000000-%' $$;

-- cover for the demo absence first (only if migration 073 is applied): it points at demo lesson plans and lessons, which are removed below
do $$ begin
  if to_regclass('public.substitution_assignments') is not null then
    delete from substitution_assignments where pg_temp.is_demo(id);
    delete from teacher_absences where pg_temp.is_demo(id);
  end if;
end $$;

delete from marking_point_responses where response_id in (select r.id from responses r join exam_sessions s on s.id = r.session_id where pg_temp.is_demo(s.id));
delete from responses where session_id in (select id from exam_sessions where pg_temp.is_demo(id));
delete from exam_sessions where pg_temp.is_demo(id);
delete from final_exam_questions where pg_temp.is_demo(final_exam_id);
delete from final_exam_class_groups where pg_temp.is_demo(final_exam_id);
update draft_exams set published_final_exam_id = null where pg_temp.is_demo(id);
delete from final_exams where pg_temp.is_demo(id);
delete from questions where pg_temp.is_demo(draft_exam_id);
delete from draft_exam_class_groups where pg_temp.is_demo(draft_exam_id);
delete from draft_exams where pg_temp.is_demo(id);

-- learning part
delete from department_resources where pg_temp.is_demo(id);
delete from lesson_plans where pg_temp.is_demo(id);
delete from flashcards where pg_temp.is_demo(deck_id);
delete from flashcard_decks where pg_temp.is_demo(id);
delete from learning_check_attempts where pg_temp.is_demo(lesson_id);
delete from learning_progress where pg_temp.is_demo(lesson_id);
delete from learning_check_questions where pg_temp.is_demo(lesson_id);
delete from learning_assignments where pg_temp.is_demo(lesson_id);
delete from learning_lessons where pg_temp.is_demo(id);

-- demo topics (only if nothing real uses them), and the morning-register rows the seed marked for the demo class
delete from curriculum_topics ct where pg_temp.is_demo(ct.id)
  and not exists (select 1 from questions q where q.topic_id = ct.id)
  and not exists (select 1 from learning_lessons l where l.topic_id = ct.id)
  and not exists (select 1 from lesson_plans p where p.topic_id = ct.id)
  and not exists (select 1 from department_resources r where r.topic_id = ct.id);
delete from daily_attendance da
where da.marked_by = (select id from profiles where full_name = 'Testing Teacher' and role = 'teacher' limit 1)
  and da.att_date >= current_date - 30
  and da.student_id in (select e.student_id from enrollments e where e.class_group_id in
        (select tcg.class_group_id from teacher_class_groups tcg where tcg.teacher_id = (select id from profiles where full_name = 'Testing Teacher' and role = 'teacher' limit 1)));

-- the demo timetable
-- the second pack's attendance (the English and Science teachers' classes)
delete from daily_attendance da
where da.att_date >= current_date - 30
  and da.marked_by in (select id from profiles where full_name in ('Testing English Teacher', 'Testing Science Teacher') and role = 'teacher')
  and da.student_id in (select e.student_id from enrollments e where e.class_group_id in
        (select tcg.class_group_id from teacher_class_groups tcg where tcg.teacher_id in (select id from profiles where full_name in ('Testing English Teacher', 'Testing Science Teacher') and role = 'teacher')));

-- school part: the demo timetable
delete from section_enrollments where pg_temp.is_demo(section_id);
delete from timetable_sections where pg_temp.is_demo(id);

-- weekly class feedback (only if migration 091 is applied)
do $$ begin
  if to_regclass('public.weekly_class_feedback') is not null then
    delete from weekly_class_feedback where pg_temp.is_demo(id);
    delete from weekly_class_reflections where pg_temp.is_demo(id);
  end if;
end $$;

-- student support plans (only if migration 092 is applied)
do $$ begin
  if to_regclass('public.support_cases') is not null then
    delete from support_actions where pg_temp.is_demo(id);
    delete from support_cases where pg_temp.is_demo(id);
  end if;
end $$;

-- the demo report-card term (its comments and attendance go with it)
delete from academic_terms where pg_temp.is_demo(id);
commit;
select 'Demo data removed' as result;
