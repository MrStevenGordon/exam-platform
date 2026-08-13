-- 029's timetable_sections.teacher_id and section_enrollments.student_id
-- referenced auth.users(id). Functionally fine for RLS/joins written by
-- hand, but PostgREST's embedded-select syntax (teacher:profiles!teacher_id(...))
-- resolves relationships from actual foreign key constraints, and finds
-- none between timetable_sections and profiles as a result -- confirmed
-- via curl: PGRST200, "Could not find a relationship between
-- timetable_sections and profiles". teacher_class_groups already gets
-- this right (its teacher_id references profiles, not auth.users), which
-- is exactly why the class-assignments page's embedded profiles(...)
-- select already works. Repointing both FKs to match that convention.

alter table public.timetable_sections drop constraint timetable_sections_teacher_id_fkey;
alter table public.timetable_sections add constraint timetable_sections_teacher_id_fkey
  foreign key (teacher_id) references public.profiles(id) on delete cascade;

alter table public.section_enrollments drop constraint section_enrollments_student_id_fkey;
alter table public.section_enrollments add constraint section_enrollments_student_id_fkey
  foreign key (student_id) references public.profiles(id) on delete cascade;
