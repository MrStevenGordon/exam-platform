-- 070: only teachers and heads of department can create and own Smart Learning lessons.
--
-- Until now any staff role (including the school admin and the principal / vice principal) could create lessons
-- of their own. School admins and the principal team are now an oversight role in Smart Learning: they see school-wide
-- Coverage and the flagged tutor list, and (school admin) can read every lesson, but they do not teach in it.
--
-- Two changes, both narrowing:
--   * the "Staff manage their own lessons" rule now applies to teachers and HODs only
--   * learning_owns_lesson(), which every "owner" rule on assignments, checks and progress relies on, is true only for a
--     teacher or HOD who owns the lesson
-- Nothing is deleted. A lesson an admin created earlier would stay readable to school admins but could no longer be
-- edited or assigned by its author. Students, teachers and HODs are unaffected.
-- Roll back with scripts/migrations/rollback/070_learning_teachers_only_rollback.sql

begin;

drop policy if exists "Staff manage their own lessons" on public.learning_lessons;
drop policy if exists "Teachers and HODs manage their own lessons" on public.learning_lessons;
create policy "Teachers and HODs manage their own lessons" on public.learning_lessons
  for all
  using (teacher_id = auth.uid() and public.my_role() in ('teacher', 'supervisor'))
  with check (teacher_id = auth.uid() and public.my_role() in ('teacher', 'supervisor'));

create or replace function public.learning_owns_lesson(p_lesson_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from learning_lessons l where l.id = p_lesson_id and l.teacher_id = auth.uid())
     and public.my_role() in ('teacher', 'supervisor')
$$;

commit;
