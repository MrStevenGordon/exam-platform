begin;

drop policy if exists "Users can read relevant profiles" on public.profiles;

create policy "Users can read relevant profiles" on public.profiles
for select
using (
  auth.uid() = id
  or is_admin()
  or (((auth.jwt() -> 'app_metadata') ->> 'is_system_admin'))::boolean = true
  or department_id = my_profile_department_id()
  or (my_role() = 'supervisor' and department_id = my_supervised_department())
);

commit;
