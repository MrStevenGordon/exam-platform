-- Smart Assess Play: Math Duels. Two students answer the same question set
-- and compare scores. Everything is server-authoritative in the API: the
-- browser never writes these tables directly and never sees the opponent's
-- answers. A duel's scores are only revealed once BOTH players have finished.

create table if not exists play_duels (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references play_accounts(id) on delete cascade,
  opponent_id uuid not null references play_accounts(id) on delete cascade,
  subject text not null,
  -- Null means a mixed set across every topic in the subject.
  topic text,
  question_count integer not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint play_duels_not_self check (created_by <> opponent_id)
);
create index if not exists play_duels_created_by_idx on play_duels (created_by, created_at desc);
create index if not exists play_duels_opponent_idx on play_duels (opponent_id, created_at desc);

-- The exact set both players answer, fixed when the duel is created.
create table if not exists play_duel_questions (
  duel_id uuid not null references play_duels(id) on delete cascade,
  question_id uuid not null references play_questions(id) on delete cascade,
  order_index integer not null,
  primary key (duel_id, question_id)
);

-- One row per player per question, inserted when they answer. The primary
-- key makes a second answer to the same question impossible.
create table if not exists play_duel_answers (
  duel_id uuid not null references play_duels(id) on delete cascade,
  account_id uuid not null references play_accounts(id) on delete cascade,
  question_id uuid not null references play_questions(id) on delete cascade,
  answer text not null,
  points_awarded numeric not null,
  answered_at timestamptz not null default now(),
  primary key (duel_id, account_id, question_id)
);
