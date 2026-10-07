begin;
drop index if exists public.library_books_genre_idx;
alter table public.library_books drop constraint if exists library_books_genre_check;
alter table public.library_books drop column if exists genre;
commit;
select 'Central migration 002 rolled back' as result;
