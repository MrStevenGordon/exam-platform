-- 084: student flashcards (Smart Learning).
--
-- A student's own revision decks. Each student makes decks, adds cards (front and back), and studies them; every card remembers how
-- well the student knows it so the ones they miss come back sooner (the Leitner box method, worked out in the app:
-- src/lib/flashcardsPure.ts).
--
-- PRIVACY: decks and cards belong to the student who made them and nobody else can read or change them: not another student,
-- not a teacher, not the school admin or principal. It is personal study material, so there is deliberately no staff view.
-- Nothing is ever sent to an AI.
--
-- LIMITS (so one account cannot fill the database): 50 decks per student, 500 cards per deck, front up to 500 characters, back
-- up to 1000 characters.
--
-- Adds two tables and a probe function. Nothing existing changes.
-- Roll back with scripts/migrations/rollback/084_flashcards_rollback.sql

begin;

create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (btrim(title) <> '' and length(title) <= 120),
  subject text check (subject is null or length(subject) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index flashcard_decks_student_idx on public.flashcard_decks (student_id, updated_at desc);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  front text not null check (btrim(front) <> '' and length(front) <= 500),
  back text not null check (btrim(back) <> '' and length(back) <= 1000),
  -- how well the student knows it: box 1 (just missed or new) up to box 5 (known well), and when it is next due
  box int not null default 1 check (box between 1 and 5),
  due_at timestamptz not null default now(),
  times_seen int not null default 0 check (times_seen >= 0),
  times_correct int not null default 0 check (times_correct >= 0),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index flashcards_deck_idx on public.flashcards (deck_id, due_at);

-- limits
create or replace function public.trg_flashcard_decks_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and (select count(*) from flashcard_decks where student_id = new.student_id) >= 50 then
    raise exception 'You can have up to 50 decks. Delete one you no longer need.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.student_id <> old.student_id then
    raise exception 'A deck cannot change owner.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger flashcard_decks_guard before insert or update on public.flashcard_decks
  for each row execute function public.trg_flashcard_decks_guard();

create or replace function public.trg_flashcards_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and (select count(*) from flashcards where deck_id = new.deck_id) >= 500 then
    raise exception 'A deck can have up to 500 cards.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.deck_id <> old.deck_id then
    raise exception 'A card cannot move to another deck.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger flashcards_guard before insert or update on public.flashcards
  for each row execute function public.trg_flashcards_guard();

-- touching a card keeps the deck's "last used" fresh
create or replace function public.trg_flashcards_touch_deck()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update flashcard_decks set updated_at = now() where id = coalesce(new.deck_id, old.deck_id);
  return null;
end $$;
create trigger flashcards_touch_deck after insert or update or delete on public.flashcards
  for each row execute function public.trg_flashcards_touch_deck();

alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;

create policy "Students manage their own decks" on public.flashcard_decks
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "Students manage the cards in their own decks" on public.flashcards
  for all using (exists (select 1 from flashcard_decks d where d.id = flashcards.deck_id and d.student_id = auth.uid()))
  with check (exists (select 1 from flashcard_decks d where d.id = flashcards.deck_id and d.student_id = auth.uid()));

revoke all on public.flashcard_decks, public.flashcards from anon, public;
grant select, insert, update, delete on public.flashcard_decks, public.flashcards to authenticated;

-- Tiny probe so the app can hide Flashcards until this migration is installed.
create or replace function public.flashcards_ready()
returns boolean language sql immutable as $$ select true $$;
grant execute on function public.flashcards_ready() to authenticated;

commit;
select 'Migration 084 applied' as result;
