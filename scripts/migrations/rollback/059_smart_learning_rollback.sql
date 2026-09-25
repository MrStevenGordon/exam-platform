-- Removes Smart Learning lessons, assignments and student progress (all of it is deleted).
-- If 060 (check questions and evidence) is applied, roll that back FIRST: the database refuses to
-- drop the lessons table while check questions still depend on it.
begin;
drop function if exists public.learning_lesson_stats();
drop function if exists public.learning_results(uuid);
drop function if exists public.learning_mark_step(uuid, text, boolean);
drop function if exists public.learning_get_lesson(uuid);
drop function if exists public.learning_student_lessons();
drop function if exists public.learning_student_access(uuid);
drop function if exists public.learning_unpublish(uuid);
drop function if exists public.learning_publish(uuid);
drop table if exists public.learning_progress;
drop table if exists public.learning_assignments;
drop table if exists public.learning_lessons;
drop function if exists public.trg_learning_assignments_guard();
drop function if exists public.trg_learning_lessons_guard();
drop function if exists public.learning_teaches_class(uuid);
drop function if exists public.learning_owns_lesson(uuid);
drop function if exists public.learning_steps_valid(jsonb, boolean);
commit;
