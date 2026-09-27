-- Storage (file upload) rules for a school project: who may upload or read which files.
--
-- Supabase keeps these in the `storage` schema, which the structure copy in provision-school-db.mjs does not
-- include, so a new school project has the buckets but no rules and every upload fails with "new row violates
-- row-level security policy". provision-school-db.mjs now applies this file; for a project that was already
-- provisioned, run it once in that project's SQL editor. Safe to run more than once.
-- Copied from the template project's live rules (12 rules on storage.objects).

begin;

alter table storage.objects enable row level security;

drop policy if exists "Admins can update school logo" on storage.objects;
create policy "Admins can update school logo" on storage.objects
  for update to public
  using (((bucket_id = 'school-logo'::text) AND ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true))));

drop policy if exists "Admins can upload school logo" on storage.objects;
create policy "Admins can upload school logo" on storage.objects
  for insert to public
  with check (((bucket_id = 'school-logo'::text) AND ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true))));

drop policy if exists "Anyone can view question images" on storage.objects;
create policy "Anyone can view question images" on storage.objects
  for select to public
  using ((bucket_id = 'question-images'::text));

drop policy if exists "Public read access to question media" on storage.objects;
create policy "Public read access to question media" on storage.objects
  for select to public
  using ((bucket_id = 'question-media'::text));

drop policy if exists "Public read access to school logo" on storage.objects;
create policy "Public read access to school logo" on storage.objects
  for select to public
  using ((bucket_id = 'school-logo'::text));

drop policy if exists "Public read access to task submissions" on storage.objects;
create policy "Public read access to task submissions" on storage.objects
  for select to public
  using ((bucket_id = 'task-submissions'::text));

drop policy if exists "Students update their own task submissions" on storage.objects;
create policy "Students update their own task submissions" on storage.objects
  for update to public
  using (((bucket_id = 'task-submissions'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'student'::text))))));

drop policy if exists "Students upload their own task submissions" on storage.objects;
create policy "Students upload their own task submissions" on storage.objects
  for insert to public
  with check (((bucket_id = 'task-submissions'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'student'::text))))));

drop policy if exists "Teachers can delete own question images" on storage.objects;
create policy "Teachers can delete own question images" on storage.objects
  for delete to public
  using (((bucket_id = 'question-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

drop policy if exists "Teachers can upload question images" on storage.objects;
create policy "Teachers can upload question images" on storage.objects
  for insert to public
  with check (((bucket_id = 'question-images'::text) AND (auth.role() = 'authenticated'::text)));

drop policy if exists "Teachers update question media" on storage.objects;
create policy "Teachers update question media" on storage.objects
  for update to public
  using (((bucket_id = 'question-media'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::text, 'supervisor'::text, 'admin'::text])))))));

drop policy if exists "Teachers upload question media" on storage.objects;
create policy "Teachers upload question media" on storage.objects
  for insert to public
  with check (((bucket_id = 'question-media'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::text, 'supervisor'::text, 'admin'::text])))))));

commit;
