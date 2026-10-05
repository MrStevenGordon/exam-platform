-- Smart Learning Library, Stage 1: remembering where each person is in each book.
--
-- One row per person per book. It keeps just enough to show "Continue reading" without calling the central
-- catalog: the title, author and cover colours (copied when they open the book), the page they reached in the
-- PDF, how far through the audio they are, and an overall percentage. The book itself lives in the central
-- project (see scripts/migrations/central/001_library_catalog.sql), so book_id has no foreign key here.
--
-- People read only their own rows. They write through library_save_progress(), which bounds every value, so a
-- browser can never store anything odd. Teachers will see their class's progress in Stage 2, through
-- assignments; nothing here lets one person read another's reading.
--
-- Nothing existing is touched. Roll back with scripts/migrations/rollback/077_library_progress_rollback.sql

begin;

create table public.library_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null,
  book_title text not null,
  book_author text not null default '',
  cover_bg text not null default '#1E1208',
  cover_fg text not null default '#F6EDE0',
  last_format text check (last_format in ('read', 'listen')),
  read_file_id uuid,
  read_page integer not null default 0 check (read_page >= 0),
  read_pages integer not null default 0 check (read_pages >= 0),
  listen_file_id uuid,
  listen_seconds integer not null default 0 check (listen_seconds >= 0),
  listen_duration integer not null default 0 check (listen_duration >= 0),
  percent integer not null default 0 check (percent between 0 and 100),
  started_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (user_id, book_id)
);
create index library_progress_recent_idx on public.library_progress (user_id, last_opened_at desc);

alter table public.library_progress enable row level security;

create policy "People read their own reading" on public.library_progress
  for select using (user_id = auth.uid());

-- Saves progress for the signed-in person. Only the fields for the format they are using are touched, so
-- reading a book does not wipe where they were in its audio. The overall percentage only ever goes up, and
-- finished_at is set the first time it reaches 100 and never cleared.
create or replace function public.library_save_progress(
  p_book_id uuid,
  p_title text,
  p_author text,
  p_cover_bg text,
  p_cover_fg text,
  p_format text,
  p_file_id uuid,
  p_page integer,
  p_pages integer,
  p_seconds integer,
  p_duration integer,
  p_percent integer
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_percent integer := greatest(0, least(100, coalesce(p_percent, 0)));
begin
  if v_uid is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = v_uid and coalesce(is_active, true)) then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  if p_format not in ('read', 'listen') then raise exception 'Unknown format.' using errcode = 'P0001'; end if;
  if p_title is null or length(trim(p_title)) = 0 then raise exception 'A book needs a title.' using errcode = 'P0001'; end if;

  insert into library_progress as lp (
    user_id, book_id, book_title, book_author, cover_bg, cover_fg, last_format,
    read_file_id, read_page, read_pages, listen_file_id, listen_seconds, listen_duration, percent, finished_at
  ) values (
    v_uid, p_book_id, left(p_title, 200), left(coalesce(p_author, ''), 200),
    case when p_cover_bg ~ '^#[0-9A-Fa-f]{6}$' then p_cover_bg else '#1E1208' end,
    case when p_cover_fg ~ '^#[0-9A-Fa-f]{6}$' then p_cover_fg else '#F6EDE0' end,
    p_format,
    case when p_format = 'read' then p_file_id end, case when p_format = 'read' then greatest(0, coalesce(p_page, 0)) else 0 end, case when p_format = 'read' then greatest(0, coalesce(p_pages, 0)) else 0 end,
    case when p_format = 'listen' then p_file_id end, case when p_format = 'listen' then greatest(0, coalesce(p_seconds, 0)) else 0 end, case when p_format = 'listen' then greatest(0, coalesce(p_duration, 0)) else 0 end,
    v_percent, case when v_percent >= 100 then now() end
  )
  on conflict (user_id, book_id) do update set
    book_title = excluded.book_title,
    book_author = excluded.book_author,
    cover_bg = excluded.cover_bg,
    cover_fg = excluded.cover_fg,
    last_format = p_format,
    read_file_id = case when p_format = 'read' then p_file_id else lp.read_file_id end,
    read_page = case when p_format = 'read' then greatest(0, coalesce(p_page, 0)) else lp.read_page end,
    read_pages = case when p_format = 'read' then greatest(0, coalesce(p_pages, 0)) else lp.read_pages end,
    listen_file_id = case when p_format = 'listen' then p_file_id else lp.listen_file_id end,
    listen_seconds = case when p_format = 'listen' then greatest(0, coalesce(p_seconds, 0)) else lp.listen_seconds end,
    listen_duration = case when p_format = 'listen' then greatest(0, coalesce(p_duration, 0)) else lp.listen_duration end,
    percent = greatest(lp.percent, v_percent),
    last_opened_at = now(),
    finished_at = coalesce(lp.finished_at, case when v_percent >= 100 then now() end);
end;
$$;

revoke execute on function public.library_save_progress(uuid, text, text, text, text, text, uuid, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.library_save_progress(uuid, text, text, text, text, text, uuid, integer, integer, integer, integer, integer) to authenticated;

commit;

-- Only reached when everything above committed. If this row does not appear, nothing was applied.
select 'Migration 077 applied' as result;
