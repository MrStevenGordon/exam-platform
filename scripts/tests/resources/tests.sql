-- Tests for migration 087 (department resources). Run on a throwaway database AFTER the student-topics seed.sql, storage-stub.sql and 087.
-- Prints PASS or FAIL per check; the last table must say failed = 0.
create temp table results (name text, ok boolean, detail text);
create or replace function check_that(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;
create or replace function as_user(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true); set local role authenticated; end $$;
create or replace function n_rows(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin perform as_user(p_uid); execute 'select count(*) from (' || p_sql || ') t' into n; reset role; return n; end $$;
create or replace function try_sql(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare n bigint;
begin perform as_user(p_uid); begin execute p_sql; get diagnostics n = row_count; reset role; return 'ok:' || n;
  exception when others then reset role; return 'error:' || sqlstate; end; end $$;
create or replace function call_as(p_uid uuid, p_sql text) returns jsonb language plpgsql as $$
declare r jsonb;
begin perform as_user(p_uid); execute p_sql into r; reset role; return r; end $$;

-- people: Maths (dept 201) head u(3) + teachers u(11) Tina, u(14) Teo (Science teacher who also teaches Maths); Science (202) head u(4) + teacher u(13); inactive u(12) in Maths
delete from department_resources; delete from teacher_subjects; update profiles set department_id = null; update departments set head_id = null; delete from departments;
insert into auth.users (id, email) select u(n), 'user' || n || '@test.local' from unnest(array[3,4,13,14]) n on conflict do nothing;
insert into departments (id, name, head_id) values (u(201), 'Mathematics', null), (u(202), 'Science', null);
insert into profiles (id, full_name, role, department_id, is_active) values
  (u(3), 'Hal Hodmath', 'supervisor', u(201), true), (u(4), 'Sue Hodsci', 'supervisor', u(202), true),
  (u(13), 'Sam Scienceteacher', 'teacher', u(202), true), (u(14), 'Teo Both', 'teacher', u(202), true)
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, department_id = excluded.department_id, is_active = excluded.is_active;
update profiles set role = 'teacher', department_id = u(201), is_active = true, full_name = 'Tina Teacher' where id = u(11);
update profiles set role = 'teacher', department_id = u(201), is_active = false where id = u(12);
update departments set head_id = u(3) where id = u(201); update departments set head_id = u(4) where id = u(202);
insert into teacher_subjects (teacher_id, department_id, subject) values (u(14), u(201), 'Mathematics');

-- ============ who belongs where ============
select check_that('Tina belongs to Maths and not to Science', call_as(u(11), 'select to_jsonb(public.resource_is_member(''' || u(201) || '''))') = 'true'::jsonb and call_as(u(11), 'select to_jsonb(public.resource_is_member(''' || u(202) || '''))') = 'false'::jsonb);
select check_that('Teo belongs to Science (his department) AND Maths (a subject he teaches)', call_as(u(14), 'select to_jsonb(public.resource_is_member(''' || u(201) || ''') and public.resource_is_member(''' || u(202) || '''))') = 'true'::jsonb);
select check_that('The inactive teacher belongs nowhere', call_as(u(12), 'select to_jsonb(public.resource_is_member(''' || u(201) || '''))') = 'false'::jsonb);
select check_that('A student belongs nowhere', call_as(u(101), 'select to_jsonb(public.resource_is_member(''' || u(201) || '''))') = 'false'::jsonb);
select check_that('Only the head is the head', call_as(u(3), 'select to_jsonb(public.resource_is_head(''' || u(201) || '''))') = 'true'::jsonb and call_as(u(11), 'select to_jsonb(public.resource_is_head(''' || u(201) || '''))') = 'false'::jsonb and call_as(u(4), 'select to_jsonb(public.resource_is_head(''' || u(201) || '''))') = 'false'::jsonb);

-- ============ sharing ============
select check_that('Tina can share a link into Maths', try_sql(u(11), 'insert into department_resources (department_id, title, kind, url, subject, grade) values (''' || u(201) || ''', ''Fractions worksheet'', ''link'', ''https://example.org/fractions'', ''Mathematics'', 8)') = 'ok:1');
select check_that('Tina cannot share into Science', try_sql(u(11), 'insert into department_resources (department_id, title, kind, url) values (''' || u(202) || ''', ''Sneaky'', ''link'', ''https://example.org/x'')') like 'error:%');
select check_that('Tina cannot share as someone else', try_sql(u(11), 'insert into department_resources (department_id, created_by, title, kind, url) values (''' || u(201) || ''', ''' || u(13) || ''', ''Forged'', ''link'', ''https://example.org/x'')') like 'error:%');
select check_that('A student cannot share', try_sql(u(101), 'insert into department_resources (department_id, title, kind, url) values (''' || u(201) || ''', ''Student'', ''link'', ''https://example.org/x'')') like 'error:%');
select check_that('The inactive teacher cannot share', try_sql(u(12), 'insert into department_resources (department_id, title, kind, url) values (''' || u(201) || ''', ''Inactive'', ''link'', ''https://example.org/x'')') like 'error:%');
select check_that('Teo can share into Maths through his subject', try_sql(u(14), 'insert into department_resources (department_id, title, kind, url) values (''' || u(201) || ''', ''Teo link'', ''link'', ''https://example.org/teo'')') = 'ok:1');
select check_that('Tina cannot pin her own item when sharing it', try_sql(u(11), 'insert into department_resources (department_id, title, kind, url, pinned) values (''' || u(201) || ''', ''Pin me'', ''link'', ''https://example.org/p'', true)') = 'error:42501');
select check_that('A file can be shared with a path inside its department', try_sql(u(11), 'insert into department_resources (department_id, title, kind, file_path, file_name, file_size, mime_type) values (''' || u(201) || ''', ''Past paper'', ''file'', ''' || u(201) || '/paper-1.pdf'', ''paper.pdf'', 1000, ''application/pdf'')') = 'ok:1');
select check_that('A file path inside ANOTHER department is refused', try_sql(u(11), 'insert into department_resources (department_id, title, kind, file_path, file_name, file_size) values (''' || u(201) || ''', ''Bad path'', ''file'', ''' || u(202) || '/paper-2.pdf'', ''p.pdf'', 1000)') like 'error:%');

-- rules on the data
select check_that('http:// links are refused', try_sql(u(11), 'insert into department_resources (department_id, title, kind, url) values (''' || u(201) || ''', ''x'', ''link'', ''http://example.org'')') like 'error:%');
select check_that('Links with spaces or javascript: are refused', try_sql(u(11), 'insert into department_resources (department_id, title, kind, url) values (''' || u(201) || ''', ''x'', ''link'', ''https://exa mple.org'')') like 'error:%' and try_sql(u(11), 'insert into department_resources (department_id, title, kind, url) values (''' || u(201) || ''', ''x'', ''link'', ''javascript:alert(1)'')') like 'error:%');
select check_that('A link with a file path is refused, and a file with a link', try_sql(u(11), 'insert into department_resources (department_id, title, kind, url, file_path, file_name) values (''' || u(201) || ''', ''x'', ''link'', ''https://e.org'', ''' || u(201) || '/a.pdf'', ''a'')') like 'error:%' and try_sql(u(11), 'insert into department_resources (department_id, title, kind, url, file_path, file_name) values (''' || u(201) || ''', ''x'', ''file'', ''https://e.org'', ''' || u(201) || '/a.pdf'', ''a'')') like 'error:%');
select check_that('A blank title, a title over 150, a grade of 14 and a file over 20 MB are refused',
  try_sql(u(11), 'insert into department_resources (department_id, title, kind, url) values (''' || u(201) || ''', ''  '', ''link'', ''https://e.org'')') like 'error:%'
  and try_sql(u(11), 'insert into department_resources (department_id, title, kind, url) values (''' || u(201) || ''', ''' || repeat('x', 151) || ''', ''link'', ''https://e.org'')') like 'error:%'
  and try_sql(u(11), 'insert into department_resources (department_id, title, kind, url, grade) values (''' || u(201) || ''', ''g'', ''link'', ''https://e.org'', 14)') like 'error:%'
  and try_sql(u(11), 'insert into department_resources (department_id, title, kind, file_path, file_name, file_size) values (''' || u(201) || ''', ''big'', ''file'', ''' || u(201) || '/big.pdf'', ''big.pdf'', 20971521)') like 'error:%');

-- ============ seeing ============
select check_that('Tina sees the 3 Maths items', n_rows(u(11), 'select 1 from department_resources') = 3);
select check_that('Teo sees the Maths items too', n_rows(u(14), 'select 1 from department_resources where department_id = ''' || u(201) || '''') = 3);
select check_that('The Maths head sees them', n_rows(u(3), 'select 1 from department_resources') = 3);
select check_that('A Science-only teacher sees none of them', n_rows(u(13), 'select 1 from department_resources') = 0);
select check_that('The Science head sees none of them', n_rows(u(4), 'select 1 from department_resources') = 0);
select check_that('A STUDENT sees nothing', n_rows(u(101), 'select 1 from department_resources') = 0);
select check_that('The inactive teacher sees nothing', n_rows(u(12), 'select 1 from department_resources') = 0);
select check_that('The principal sees nothing', n_rows(u(2), 'select 1 from department_resources') = 0);
select check_that('The school admin sees them all (to moderate)', n_rows(u(1), 'select 1 from department_resources') = 3);
select check_that('Signed-out callers have no access', not has_table_privilege('anon', 'public.department_resources', 'select'));

-- ============ editing and pinning ============
select check_that('The owner can edit their own title', try_sql(u(11), 'update department_resources set title = ''Fractions worksheet v2'' where title = ''Fractions worksheet''') = 'ok:1');
select check_that('A colleague (Teo) cannot edit it (no rows change)', try_sql(u(14), 'update department_resources set title = ''Teo was here'' where title like ''Fractions%''') = 'ok:0');
create temp table pin_try as select try_sql(u(3), 'update department_resources set pinned = true where title like ''Fractions%''') as r;
select check_that('The head can PIN it, and the pin records who and when', (select r from pin_try) = 'ok:1' and (select pinned_by from department_resources where title like 'Fractions%') = u(3) and (select pinned_at is not null from department_resources where title like 'Fractions%'));
select check_that('The head cannot edit the title of someone else''s item', try_sql(u(3), 'update department_resources set title = ''Renamed by head'' where title like ''Fractions%''') = 'error:42501');
select check_that('The owner cannot unpin or pin (only the head can)', try_sql(u(11), 'update department_resources set pinned = false where title like ''Fractions%''') = 'error:42501' and try_sql(u(11), 'update department_resources set pinned = true where title = ''Past paper''') = 'error:42501');
create temp table edit_try as select try_sql(u(11), 'update department_resources set title = ''Fractions worksheet v3'' where title like ''Fractions%''') as r;
select check_that('Editing the title does not disturb the pin', (select r from edit_try) = 'ok:1' and (select pinned and pinned_by = u(3) from department_resources where title like 'Fractions%'));
select check_that('An item cannot be moved to another department, given to someone else, or changed to another kind', try_sql(u(11), 'update department_resources set department_id = ''' || u(202) || ''' where title like ''Fractions%''') like 'error:%' and try_sql(u(11), 'update department_resources set created_by = ''' || u(13) || ''' where title like ''Fractions%''') like 'error:%' and try_sql(u(11), 'update department_resources set kind = ''file'' where title like ''Fractions%''') like 'error:%');
create temp table unpin_try as select try_sql(u(3), 'update department_resources set pinned = false where title like ''Fractions%''') as r;
select check_that('The head can unpin, and the pin details clear', (select r from unpin_try) = 'ok:1' and (select pinned_by is null and pinned_at is null and not pinned from department_resources where title like 'Fractions%'));
select check_that('A Science teacher cannot touch Maths items', try_sql(u(13), 'update department_resources set title = ''x''') = 'ok:0' and try_sql(u(13), 'delete from department_resources') = 'ok:0');

-- ============ the screen's functions ============
select check_that('My departments: Tina gets Maths (not head); the Maths head is flagged head; a student gets none',
  (call_as(u(11), 'select public.resources_my_departments()') -> 0 ->> 'name') = 'Mathematics'
  and (call_as(u(11), 'select public.resources_my_departments()') -> 0 ->> 'is_head')::boolean = false
  and (call_as(u(3), 'select public.resources_my_departments()') -> 0 ->> 'is_head')::boolean = true
  and jsonb_array_length(call_as(u(101), 'select public.resources_my_departments()')) = 0);
select check_that('Teo gets two departments (Maths and Science)', jsonb_array_length(call_as(u(14), 'select public.resources_my_departments()')) = 2);
select check_that('The admin sees both departments but cannot share into them', jsonb_array_length(call_as(u(1), 'select public.resources_my_departments()')) = 2 and (call_as(u(1), 'select public.resources_my_departments()') -> 0 ->> 'can_share')::boolean = false);
create temp table lst as select call_as(u(11), 'select public.department_resources_list(''' || u(201) || ''')') as j;
select check_that('The list has the sharer''s name and the right buttons: Tina can edit hers and not Teo''s, cannot pin',
  (select count(*) from lst, jsonb_array_elements(j) e where e ->> 'shared_by' = 'Tina Teacher') = 2
  and (select bool_and((e ->> 'can_edit')::boolean = (e ->> 'mine')::boolean) from lst, jsonb_array_elements(j) e)
  and not (select bool_or((e ->> 'can_pin')::boolean) from lst, jsonb_array_elements(j) e)
  and not (select (e ->> 'can_remove')::boolean from lst, jsonb_array_elements(j) e where e ->> 'title' = 'Teo link'));
select check_that('A file item in the list carries its path (so the page can open and remove it) and a link item carries its address', (select e ->> 'file_path' from lst, jsonb_array_elements(j) e where e ->> 'kind' = 'file') = u(201)::text || '/paper-1.pdf' and (select e ->> 'url' from lst, jsonb_array_elements(j) e where e ->> 'title' = 'Teo link') = 'https://example.org/teo');
select check_that('The head can pin and remove anything in the list', (select bool_and((e ->> 'can_pin')::boolean and (e ->> 'can_remove')::boolean) from (select jsonb_array_elements(call_as(u(3), 'select public.department_resources_list(''' || u(201) || ''')')) e) x));
select check_that('A Science teacher gets an empty Science list but is refused the Maths list; a student is refused', call_as(u(13), 'select public.department_resources_list(''' || u(202) || ''')') = '[]'::jsonb and try_sql(u(13), 'select public.department_resources_list(''' || u(201) || ''')') = 'error:42501' and try_sql(u(101), 'select public.department_resources_list(''' || u(201) || ''')') = 'error:42501');

-- ============ the file bucket ============
select check_that('The bucket is private with a 20 MB limit', (select not public and file_size_limit = 20971520 from storage.buckets where id = 'department-resources'));
select check_that('A Maths teacher can upload into the Maths folder', try_sql(u(11), 'insert into storage.objects (bucket_id, name, owner_id) values (''department-resources'', ''' || u(201) || '/paper-1.pdf'', ''' || u(11) || ''')') = 'ok:1');
select check_that('She cannot upload into the Science folder or a path with no department', try_sql(u(11), 'insert into storage.objects (bucket_id, name, owner_id) values (''department-resources'', ''' || u(202) || '/x.pdf'', ''' || u(11) || ''')') like 'error:%' and try_sql(u(11), 'insert into storage.objects (bucket_id, name, owner_id) values (''department-resources'', ''loose.pdf'', ''' || u(11) || ''')') like 'error:%');
select check_that('A student cannot upload', try_sql(u(101), 'insert into storage.objects (bucket_id, name, owner_id) values (''department-resources'', ''' || u(201) || '/s.pdf'', ''' || u(101) || ''')') like 'error:%');
select check_that('Department members can read the file; other departments, students and the principal cannot; the admin can',
  n_rows(u(14), 'select 1 from storage.objects where bucket_id = ''department-resources''') = 1
  and n_rows(u(13), 'select 1 from storage.objects where bucket_id = ''department-resources''') = 0
  and n_rows(u(101), 'select 1 from storage.objects where bucket_id = ''department-resources''') = 0
  and n_rows(u(2), 'select 1 from storage.objects where bucket_id = ''department-resources''') = 0
  and n_rows(u(1), 'select 1 from storage.objects where bucket_id = ''department-resources''') = 1);
select check_that('A colleague cannot delete someone else''s file; the head can',
  try_sql(u(14), 'delete from storage.objects where bucket_id = ''department-resources''') = 'ok:0'
  and try_sql(u(13), 'delete from storage.objects where bucket_id = ''department-resources''') = 'ok:0'
  and try_sql(u(3), 'delete from storage.objects where bucket_id = ''department-resources''') = 'ok:1');
insert into storage.objects (bucket_id, name, owner_id) values ('department-resources', u(201)::text || '/orphan.pdf', u(11)::text);
select check_that('The uploader can remove their own upload even when no resource was saved for it', try_sql(u(11), 'delete from storage.objects where name like ''%orphan.pdf''') = 'ok:1');

-- ============ removing and limits ============
select check_that('The owner can remove their own item', try_sql(u(11), 'delete from department_resources where title = ''Past paper''') = 'ok:1');
select check_that('A colleague cannot remove it; the head can remove Teo''s link; the admin can remove one too',
  try_sql(u(14), 'delete from department_resources where title like ''Fractions%''') = 'ok:0'
  and try_sql(u(3), 'delete from department_resources where title = ''Teo link''') = 'ok:1'
  and try_sql(u(1), 'delete from department_resources where title like ''Fractions%''') = 'ok:1');
insert into department_resources (department_id, created_by, title, kind, url) select u(201), u(11), 'Bulk ' || g, 'link', 'https://example.org/' || g from generate_series(1, 300) g;
select check_that('The 301st item from one person is refused', try_sql(u(11), 'insert into department_resources (department_id, title, kind, url) values (''' || u(201) || ''', ''One too many'', ''link'', ''https://e.org'')') = 'error:P0001');

select case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by ok, name;
select count(*) filter (where not ok) as failed, count(*) as total from results;
