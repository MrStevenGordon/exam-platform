-- Smart Learning Library, Stage 3: what each school shows, and bookmarks and notes.
--
--   library_settings       one row per school: which shelves students see, whether audio is offered, which age bands
--                          are shown, and whether teachers may assign reading. Everyone signed in can read it (it is
--                          not secret and the screens need it); only a school admin can change it.
--   library_hidden_books   titles this school has chosen not to show. Only a school admin can see or change the list.
--                          The server also enforces it, so a hidden book cannot be opened by guessing its address.
--   library_notes          a person's own bookmarks and notes in a PDF. Private: nobody else, teachers included, can
--                          read them. A person can keep up to 300 per book.
--
-- When a school has turned "teachers may assign reading" off, the policy that lets teachers create reading
-- assignments (078) is replaced by one that also checks that setting. If 078 has not been applied yet, that part is
-- skipped: run 078 first, then this.
--
-- Nothing existing is deleted. Run after 077 (and 078 if you use assignments). Roll back with
-- scripts/migrations/rollback/079_library_school_controls_and_notes_rollback.sql

begin;

create table public.library_settings (
  id boolean primary key default true check (id),
  curriculum_shelf boolean not null default true,
  fun_shelf boolean not null default true,
  audio boolean not null default true,
  teachers_assign boolean not null default true,
  levels text[] not null default array['forms_1_3', 'forms_4_5', 'sixth_form'],
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  check (cardinality(levels) >= 1 and levels <@ array['forms_1_3', 'forms_4_5', 'sixth_form'])
);
insert into public.library_settings (id) values (true);

alter table public.library_settings enable row level security;
create policy "Everyone signed in reads the Library settings" on public.library_settings
  for select using (auth.uid() is not null);
create policy "School admins change the Library settings" on public.library_settings
  for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.library_stamp_settings()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;
create trigger library_settings_stamp before update on public.library_settings
  for each row execute function public.library_stamp_settings();

create table public.library_hidden_books (
  book_id uuid primary key,
  book_title text not null check (length(book_title) between 1 and 200),
  hidden_by uuid references public.profiles(id) on delete set null,
  hidden_at timestamptz not null default now()
);
alter table public.library_hidden_books enable row level security;
create policy "School admins manage hidden titles" on public.library_hidden_books
  for all using (public.is_admin()) with check (public.is_admin() and hidden_by = auth.uid());

create table public.library_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null,
  file_id uuid,
  page integer not null check (page >= 1),
  kind text not null check (kind in ('bookmark', 'note')),
  body text check (body is null or length(body) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'bookmark' or (body is not null and length(trim(body)) > 0))
);
create index library_notes_book_idx on public.library_notes (user_id, book_id, page);
create unique index library_notes_one_bookmark_per_page on public.library_notes (user_id, book_id, coalesce(file_id, '00000000-0000-0000-0000-000000000000'::uuid), page) where kind = 'bookmark';

alter table public.library_notes enable row level security;
create policy "People keep their own notes" on public.library_notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.library_limit_notes()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select count(*) from library_notes where user_id = new.user_id and book_id = new.book_id) >= 300 then
    raise exception 'That is the most notes and bookmarks you can keep in one book.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger library_notes_limit before insert on public.library_notes
  for each row execute function public.library_limit_notes();

-- Does this school let teachers assign reading? True unless an admin switched it off (or the setting row is missing).
create or replace function public.library_teachers_may_assign()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select coalesce((select teachers_assign from library_settings limit 1), true) $$;
revoke execute on function public.library_teachers_may_assign() from public, anon;
grant execute on function public.library_teachers_may_assign() to authenticated;

-- Only when reading assignments (078) are installed: make "teachers may assign" mean something.
do $$
begin
  if to_regclass('public.library_assignments') is not null then
    drop policy if exists "Staff assign to classes they teach" on public.library_assignments;
    create policy "Staff assign to classes they teach" on public.library_assignments
      for insert with check (assigned_by = auth.uid() and public.is_staff() and public.learning_teaches_class(class_group_id) and public.library_teachers_may_assign());
  end if;
end $$;

commit;

-- Only reached when everything above committed. If this row does not appear, nothing was applied.
select 'Migration 079 applied' as result;
