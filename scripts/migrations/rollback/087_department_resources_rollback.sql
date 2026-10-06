-- Rolls back 087_department_resources.sql. THIS DELETES EVERY SHARED RESOURCE (the list). The uploaded files stay in the
-- department-resources bucket until you remove them in Supabase Storage (Storage, department-resources, select all, delete); nothing
-- can open them once the rules are gone.
begin;
drop policy if exists "Owners and heads remove resource files" on storage.objects;
drop policy if exists "Department members read resource files" on storage.objects;
drop policy if exists "Department members add resource files" on storage.objects;
drop function if exists public.department_resources_list(uuid);
drop function if exists public.resources_my_departments();
drop function if exists public.department_resources_ready();
drop table if exists public.department_resources;
drop function if exists public.trg_department_resources_guard();
drop function if exists public.resource_path_ok(text);
drop function if exists public.resource_is_head(uuid);
drop function if exists public.resource_is_member(uuid);
commit;
select 'Migration 087 rolled back' as result;
