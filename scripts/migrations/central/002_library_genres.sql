-- Smart Learning Library: genres.
--
-- Run on the CENTRAL Supabase project (the same one as central/001), NOT a school's project.
--
-- Adds a genre to each title, so students can browse the Library by genre as well as by subject. The subject column already exists.
-- Optional: titles without a genre simply show under "Not yet sorted". Nothing existing changes.
-- Roll back with scripts/migrations/rollback/central_002_library_genres_rollback.sql

begin;

alter table public.library_books add column if not exists genre text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'library_books_genre_check') then
    alter table public.library_books add constraint library_books_genre_check
      check (genre is null or genre in ('novel', 'short_stories', 'poetry', 'drama', 'biography', 'folklore', 'non_fiction'));
  end if;
end $$;
create index if not exists library_books_genre_idx on public.library_books (genre) where genre is not null;

commit;

select 'Central migration 002 applied' as result;
