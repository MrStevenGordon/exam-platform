-- 102: which of a student's lessons have a study guide switched on, so the lesson list can say so.
--
-- WHAT: adds one read-only function, learning_student_guides(). It returns the ids of the lessons that are open to the signed-in student
-- (published, given to a class they are in, not closed) and have a study guide the teacher has switched on. It returns ids only; the guide
-- itself is still read through learning_get_guide(), which applies the same rules. A teacher, a lesson with only a draft guide, a closed
-- lesson or a lesson for another class never appears.
--
-- Needs migration 100 (study guides). Adds a function only; no table changes.
-- Roll back with scripts/migrations/rollback/102_student_guide_list_rollback.sql

begin;

do $$
begin
  if to_regclass('public.learning_lesson_guides') is null then raise exception 'Apply migration 100 (study guides) first.'; end if;
end $$;

create or replace function public.learning_student_guides()
returns table (lesson_id uuid)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  return query
  select distinct l.id
  from learning_lessons l
  join learning_lesson_guides g on g.lesson_id = l.id and g.status = 'on'
  where l.status = 'published'
    and exists (
      select 1 from learning_assignments a
      join enrollments e on e.class_group_id = a.class_group_id and e.student_id = auth.uid()
      where a.lesson_id = l.id
    )
    and public.learning_student_access(l.id) = 'open';
end;
$$;

revoke all on function public.learning_student_guides() from public, anon;
grant execute on function public.learning_student_guides() to authenticated;

commit;
