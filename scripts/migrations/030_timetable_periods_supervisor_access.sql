-- 029 only let admins manage timetable_periods, but the shared timetable
-- builder page is also used by supervisors (department HODs) -- a school
-- without a dedicated admin bootstrapping periods first would otherwise be
-- stuck. Periods are school-wide (no department_id to scope by), so this
-- is deliberately "any supervisor", not scoped to one department.

create policy "Supervisors manage timetable periods" on public.timetable_periods
  for all using (my_role() = 'supervisor' or is_admin())
  with check (my_role() = 'supervisor' or is_admin());
