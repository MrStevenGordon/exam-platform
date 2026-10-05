-- Undoes migration 079: removes the settings, hidden titles and notes (everyone's bookmarks and notes are lost), and
-- puts the assign policy back exactly as 078 defined it.
begin;
do $$
begin
  if to_regclass('public.library_assignments') is not null then
    drop policy if exists "Staff assign to classes they teach" on public.library_assignments;
    create policy "Staff assign to classes they teach" on public.library_assignments
      for insert with check (assigned_by = auth.uid() and public.is_staff() and public.learning_teaches_class(class_group_id));
  end if;
end $$;
drop function if exists public.library_teachers_may_assign();
drop trigger if exists library_notes_limit on public.library_notes;
drop function if exists public.library_limit_notes();
drop table if exists public.library_notes;
drop table if exists public.library_hidden_books;
drop trigger if exists library_settings_stamp on public.library_settings;
drop function if exists public.library_stamp_settings();
drop table if exists public.library_settings;
commit;

select 'Migration 079 rolled back' as result;
