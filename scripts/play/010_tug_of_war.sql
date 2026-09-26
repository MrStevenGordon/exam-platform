-- Smart Assess Play: Tug of War. Two teams; every student answers a stream of
-- quick tap-to-answer questions at their own pace, and each correct answer
-- pulls the rope toward their team. The rope position is decided entirely on
-- the server from the recorded answers:
--   team score = correct answers / players on the team  (so uneven sides stay fair)
--   rope       = (right score - left score) / win margin, clamped to -1..1
-- A team wins when its per-player lead reaches the win margin, or, if the clock
-- runs out first, by being ahead. Join codes are unique across live quizzes,
-- Jeopardy boards and Tug of War games.

create table if not exists play_tug_games (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  host_id uuid not null references play_accounts(id) on delete cascade,
  subject text not null,
  topic text,
  duration_seconds integer not null check (duration_seconds between 60 and 600),
  -- The per-player lead that wins outright (e.g. 5 = five more correct answers per player).
  win_margin integer not null check (win_margin between 2 and 15),
  status text not null default 'lobby' check (status in ('lobby', 'running', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  -- 0 = left team, 1 = right team, null = tie or ended without a winner.
  winner_position integer check (winner_position in (0, 1)),
  end_reason text check (end_reason in ('margin', 'time', 'host')),
  created_at timestamptz not null default now()
);
create unique index if not exists play_tug_games_open_code_idx on play_tug_games (code) where status <> 'ended';
create index if not exists play_tug_games_host_idx on play_tug_games (host_id, created_at desc);

create table if not exists play_tug_teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references play_tug_games(id) on delete cascade,
  position integer not null check (position in (0, 1)),
  name text not null,
  unique (game_id, position)
);

create table if not exists play_tug_players (
  game_id uuid not null references play_tug_games(id) on delete cascade,
  account_id uuid not null references play_accounts(id) on delete cascade,
  team_id uuid not null references play_tug_teams(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (game_id, account_id)
);

-- The question each student is on right now. Answers are only accepted for
-- this question, so a student cannot pick their questions or answer another's.
create table if not exists play_tug_player_state (
  game_id uuid not null references play_tug_games(id) on delete cascade,
  account_id uuid not null references play_accounts(id) on delete cascade,
  current_question_id uuid references play_questions(id) on delete set null,
  recent_question_ids uuid[] not null default '{}',
  -- After a wrong answer the student stumbles and must wait briefly.
  locked_until timestamptz,
  primary key (game_id, account_id)
);

create table if not exists play_tug_answers (
  id bigserial primary key,
  game_id uuid not null references play_tug_games(id) on delete cascade,
  account_id uuid not null references play_accounts(id) on delete cascade,
  team_id uuid not null references play_tug_teams(id) on delete cascade,
  question_id uuid not null references play_questions(id) on delete cascade,
  answer text not null,
  correct boolean not null,
  answered_at timestamptz not null default clock_timestamp()
);
create index if not exists play_tug_answers_game_idx on play_tug_answers (game_id, account_id);
