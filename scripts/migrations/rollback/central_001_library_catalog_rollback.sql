-- Undoes central migration 001: drops the catalog tables. Files in the 'library-books' bucket are NOT deleted
-- (remove them in the Storage screen first if you want them gone), and the bucket itself is left in place.
begin;
drop trigger if exists library_books_touch on public.library_books;
drop function if exists public.library_touch_updated_at();
drop table if exists public.library_files;
drop table if exists public.library_books;
commit;

select 'Central migration 001 rolled back' as result;
