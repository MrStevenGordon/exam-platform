create policy "Supervisors and admins view all lesson plans" on public.lesson_plans
  for select using (my_role() = 'supervisor' or is_admin());
