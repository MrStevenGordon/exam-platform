-- Smart Learning Library, Stage 1: the shared book catalog.
--
-- Like 038 (the cross-school lesson plan library), this targets the CENTRAL Supabase project, NOT a school's
-- project. Run it there. Books are added once by Smart Assess Ja and every school can use them.
--
--   library_books   one row per title: who wrote it, which shelf (curriculum or read for fun), its licence and
--                   where it came from. A book cannot be published until someone has confirmed it may be shared
--                   digitally with students (rights_confirmed).
--   library_files   the files behind a title: one or more PDFs and/or audio files (chapters), stored in the
--                   private 'library-books' bucket.
--
-- No row policies on purpose: every read and write goes through a server route that first checks the caller
-- against THAT SCHOOL's own sign-in, then uses the service key here (same reasoning as 038). Students never
-- talk to this project directly, and the bucket is private, so files are only reachable through short-lived
-- signed links the server hands out.
--
-- Roll back with scripts/migrations/rollback/central_001_library_catalog_rollback.sql

begin;

create table public.library_books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  author text not null check (length(author) between 1 and 200),
  description text check (description is null or length(description) <= 2000),
  shelf text not null check (shelf in ('curriculum', 'fun')),
  subject text check (subject is null or length(subject) <= 100),
  topic text check (topic is null or length(topic) <= 100),
  levels text[] not null default array['forms_1_3', 'forms_4_5', 'sixth_form'],
  licence text not null check (licence in ('public_domain', 'cc_by', 'cc_by_sa', 'cc_by_nc', 'licensed', 'school_owned')),
  licence_note text check (licence_note is null or length(licence_note) <= 500),
  source_url text check (source_url is null or length(source_url) <= 1000),
  attribution text check (attribution is null or length(attribution) <= 500),
  cover_bg text not null default '#1E1208' check (cover_bg ~ '^#[0-9A-Fa-f]{6}$'),
  cover_fg text not null default '#F6EDE0' check (cover_fg ~ '^#[0-9A-Fa-f]{6}$'),
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'published')),
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (status <> 'published' or rights_confirmed),
  check (levels <@ array['forms_1_3', 'forms_4_5', 'sixth_form'])
);
create index library_books_shelf_idx on public.library_books (shelf, status);

create table public.library_files (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.library_books(id) on delete cascade,
  kind text not null check (kind in ('pdf', 'audio')),
  label text not null default '' check (length(label) <= 200),
  position integer not null default 0,
  storage_path text not null unique,
  bytes bigint check (bytes is null or bytes >= 0),
  pages integer check (pages is null or pages >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now()
);
create index library_files_book_idx on public.library_files (book_id, kind, position);

create or replace function public.library_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = now();
  end if;
  return new;
end;
$$;
create trigger library_books_touch before insert or update on public.library_books
  for each row execute function public.library_touch_updated_at();

alter table public.library_books enable row level security;
alter table public.library_files enable row level security;

-- The private bucket that holds the files. Only the service key can read or write it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-books', 'library-books', false, 52428800,
        array['application/pdf', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;

commit;

-- Only reached when everything above committed. If this row does not appear, nothing was applied.
select 'Central migration 001 applied' as result;
