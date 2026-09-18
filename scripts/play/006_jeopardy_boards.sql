-- Smart Assess Play: Jeopardy-style boards. A teacher hosts a board of
-- categories (topics) by point values on the projector. Students join with the
-- same 6-digit code as live games and buzz in from their own devices; the
-- server decides who buzzed first, and the teacher judges the spoken answer.
-- Every transition is server-side; the browser only polls and posts a buzz.
--
-- Join codes are unique among open games across BOTH live_games and
-- board_games (enforced when a game is created), so one code never means two
-- different games.

create table if not exists play_board_games (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  host_id uuid not null references play_accounts(id) on delete cascade,
  subject text not null,
  rows_per_category integer not null check (rows_per_category between 3 and 5),
  deduct_wrong boolean not null default false,
  buzz_seconds integer not null default 20 check (buzz_seconds between 5 and 60),
  status text not null default 'lobby' check (status in ('lobby', 'board', 'clue', 'answering', 'reveal', 'ended')),
  current_clue_id uuid,
  clue_opened_at timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index if not exists play_board_games_open_code_idx on play_board_games (code) where status <> 'ended';
create index if not exists play_board_games_host_idx on play_board_games (host_id, created_at desc);

create table if not exists play_board_categories (
  game_id uuid not null references play_board_games(id) on delete cascade,
  position integer not null,
  topic text not null,
  primary key (game_id, position)
);

create table if not exists play_board_clues (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references play_board_games(id) on delete cascade,
  category_position integer not null,
  row_position integer not null,
  value integer not null,
  question_id uuid not null references play_questions(id) on delete cascade,
  used boolean not null default false,
  unique (game_id, category_position, row_position)
);
create index if not exists play_board_clues_game_idx on play_board_clues (game_id);

create table if not exists play_board_players (
  game_id uuid not null references play_board_games(id) on delete cascade,
  account_id uuid not null references play_accounts(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (game_id, account_id)
);

-- One row per player per clue: a player buzzes at most once per clue, so a
-- wrong answer locks them out of that clue automatically. 'pending' is the
-- player currently answering; at most one can exist per clue.
create table if not exists play_board_buzzes (
  clue_id uuid not null references play_board_clues(id) on delete cascade,
  game_id uuid not null references play_board_games(id) on delete cascade,
  account_id uuid not null references play_accounts(id) on delete cascade,
  buzzed_at timestamptz not null default clock_timestamp(),
  outcome text not null default 'pending' check (outcome in ('pending', 'correct', 'wrong')),
  primary key (clue_id, account_id)
);
create unique index if not exists play_board_buzzes_one_pending_idx on play_board_buzzes (clue_id) where outcome = 'pending';
