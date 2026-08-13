-- 032 scoped supervisor access to report_card_comments/report_card_attendance
-- via `profiles.department_id = my_supervised_department()` on the student
-- row. Turns out profiles.department_id is only ever set for staff
-- (teachers/supervisors/admins) -- it's null for every student in this
-- schema (confirmed by querying live data). Students are only tied to a
-- department indirectly, via class_groups (7-9) or timetable_sections
-- (10-11), neither of which is reliable/complete enough to join through.
--
-- The actual existing precedent for supervisor-to-student visibility in
-- this schema is unscoped: see "Supervisors view all student profiles"
-- and "Supervisors view all enrollments" (both `my_role() = 'supervisor'`,
-- no department join). Matching that here instead.

drop policy "Supervisors view their department report card comments" on public.report_card_comments;
create policy "Supervisors view report card comments" on public.report_card_comments
  for select using (my_role() = 'supervisor');

drop policy "Supervisors manage their department report card attendance" on public.report_card_attendance;
create policy "Supervisors manage report card attendance" on public.report_card_attendance
  for all using (my_role() = 'supervisor')
  with check (my_role() = 'supervisor');
