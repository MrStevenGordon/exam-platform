-- The teacher report-cards page looks up student names for whoever is
-- enrolled in one of the teacher's timetable_sections, but no existing
-- profiles RLS policy covers that relationship -- the pre-existing teacher
-- policies only cover class_group-based classes ("Teachers view profiles
-- of students in their classes") and direct-exam assignment ("...on their
-- direct exams"), neither of which the timetable feature's
-- section_enrollments table plugs into. Confirmed live: the teacher's
-- profiles lookup silently returned zero rows despite correct
-- section_enrollments data, since RLS filtered every row out.

create function public.is_teacher_of_timetable_student(check_student_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from section_enrollments se
    join timetable_sections ts on ts.id = se.section_id
    where se.student_id = check_student_id
    and ts.teacher_id = auth.uid()
  )
$$;

create policy "Teachers view profiles of students in their timetable sections" on public.profiles
  for select using (is_teacher_of_timetable_student(id));
