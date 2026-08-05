-- Bug: "Add group" (and any other read of project_groups) failed with
-- "infinite recursion detected in policy for relation project_groups".
--
-- Root cause: project_group_members' "Students view members of their own
-- group" policy queried project_group_members itself (aliased m2) to check
-- membership. Postgres has to apply RLS to that inner query too, which
-- re-evaluates the same policy, which queries the table again — infinite
-- recursion. This policy is evaluated as one of the OR'd permissive
-- policies on ANY select-touching operation against project_groups (via
-- its own "Students view their own group" policy, which queries
-- project_group_members), including the .insert().select() a teacher does
-- when creating a group — so this broke both creating AND viewing groups
-- for everyone, not just students.
--
-- Fix: move the membership check into a SECURITY DEFINER function (same
-- pattern as my_supervised_department()/is_admin() elsewhere in this
-- schema) so the internal lookup bypasses RLS instead of re-triggering it.

create or replace function is_member_of_project_group(p_group_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from project_group_members
    where group_id = p_group_id and student_id = auth.uid()
  );
$$;

drop policy if exists "Students view members of their own group" on project_group_members;
create policy "Students view members of their own group" on project_group_members
  for select
  using (is_member_of_project_group(group_id));

drop policy if exists "Students view their own group" on project_groups;
create policy "Students view their own group" on project_groups
  for select
  using (is_member_of_project_group(id));

drop policy if exists "Students upload shared file to their own group" on project_groups;
create policy "Students upload shared file to their own group" on project_groups
  for update
  using (is_member_of_project_group(id))
  with check (is_member_of_project_group(id));
