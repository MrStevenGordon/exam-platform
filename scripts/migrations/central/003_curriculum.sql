-- National curriculum text for the AI lesson planner.
--
-- Run on the CENTRAL Supabase project (the same one as the Library catalog), NOT a school's project. One copy serves every school.
--
--   curriculum_documents   one row per guide (for example "National Standards Curriculum Guide: Civics, Grades 7 to 9"):
--                          its subject, the grades it covers, who published it, and a fingerprint so the same file is never loaded twice.
--   curriculum_chunks      the guide cut into pieces of about 2,000 characters, with the page numbers and the unit or grade heading they sit
--                          under, and a search index. Cut by the loading script (scripts/load-curriculum.mjs).
--   curriculum_search()    finds the pieces that match a topic for one subject and grade. The lesson planner calls it and puts the top
--                          pieces in front of the AI as reference material.
--
-- No row policies on purpose, as for the Library: nobody signed in reads this directly. The school's server asks for excerpts using the
-- service key. Nothing here holds any student or school data.
-- Roll back with scripts/migrations/rollback/central_003_curriculum_rollback.sql

begin;

create table public.curriculum_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 300),
  subject text not null check (length(btrim(subject)) between 1 and 100),
  aliases text[] not null default '{}',
  grade_from integer not null check (grade_from between 7 and 13),
  grade_to integer not null check (grade_to between 7 and 13),
  publisher text check (publisher is null or length(publisher) <= 300),
  published_year text check (published_year is null or length(published_year) <= 20),
  licence_note text check (licence_note is null or length(licence_note) <= 600),
  pages integer check (pages is null or pages >= 0),
  chunk_count integer not null default 0,
  file_hash text not null unique check (length(file_hash) = 64),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (grade_to >= grade_from)
);

create table public.curriculum_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.curriculum_documents(id) on delete cascade,
  position integer not null,
  page_from integer,
  page_to integer,
  grade integer check (grade is null or grade between 7 and 13),   -- the grade the text itself names (for example "GRADE 7, TERM 1, UNIT 2"); null when it names none
  heading text check (heading is null or length(heading) <= 200),
  content text not null check (length(content) between 1 and 6000),
  tsv tsvector generated always as (to_tsvector('english', coalesce(heading, '') || ' ' || content)) stored,
  unique (document_id, position)
);
create index curriculum_chunks_tsv on public.curriculum_chunks using gin (tsv);
create index curriculum_chunks_doc on public.curriculum_chunks (document_id, position);

alter table public.curriculum_documents enable row level security;
alter table public.curriculum_chunks enable row level security;
revoke all on public.curriculum_documents, public.curriculum_chunks from anon, authenticated, public;

-- Does a teacher's subject ("English", "Maths") belong to a guide ("English Language")? Either name contains the other, or an alias matches.
create or replace function public.curriculum_subject_matches(p_doc_subject text, p_aliases text[], p_wanted text)
returns boolean language sql immutable
as $$
  select exists (
    select 1 from unnest(array[p_doc_subject] || coalesce(p_aliases, '{}')) n(name)
    where length(btrim(p_wanted)) >= 3
      and (lower(n.name) like '%' || lower(btrim(p_wanted)) || '%' or lower(btrim(p_wanted)) like '%' || lower(n.name) || '%')
  )
$$;

-- The best matching pieces for a topic. Pieces that contain every word of the topic come first; after them, pieces that contain any of
-- the words (so "simple interest consumer arithmetic" still finds a piece that only has some of them), best match first.
create or replace function public.curriculum_search(p_subject text, p_grade integer, p_query text, p_limit integer default 6)
returns table (document_id uuid, title text, subject text, page_from integer, page_to integer, grade integer, heading text, content text, rank real)
language sql stable
set search_path = public, pg_temp
as $$
  with words as (
    select distinct w from unnest(regexp_split_to_array(lower(coalesce(p_query, '')), '[^a-z0-9]+')) w where length(w) >= 3 limit 40
  ), q as (
    select to_tsquery('english', string_agg(w, ' | ')) as any_word, to_tsquery('english', string_agg(w, ' & ')) as all_words from words
  )
  select c.document_id, d.title, d.subject, c.page_from, c.page_to, c.grade, c.heading, c.content,
         -- text that names the requested grade counts in full; general text (the introduction, notes for every grade) counts for much less
         (ts_rank_cd(c.tsv, q.any_word, 1) * case when c.grade = p_grade then 1.0 else 0.35 end)::real as rank
  from public.curriculum_chunks c
  join public.curriculum_documents d on d.id = c.document_id
  cross join q
  where d.status = 'published'
    and q.any_word is not null
    and public.curriculum_subject_matches(d.subject, d.aliases, p_subject)
    and p_grade between d.grade_from and d.grade_to
    and (c.grade is null or c.grade = p_grade)
    and c.tsv @@ q.any_word
    and ts_rank_cd(c.tsv, q.any_word, 1) * case when c.grade = p_grade then 1.0 else 0.35 end >= 0.03
  -- pieces that contain every word come first, then the rest by how well they match
  order by (c.tsv @@ q.all_words) desc nulls last, rank desc, c.position
  limit least(greatest(coalesce(p_limit, 6), 1), 12)
$$;
revoke all on function public.curriculum_search(text, integer, text, integer), public.curriculum_subject_matches(text, text[], text) from public, anon, authenticated;

commit;

select 'Central migration 003 applied' as result;
