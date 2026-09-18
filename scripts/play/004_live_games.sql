-- Smart Assess Play: teacher-hosted live games (Kahoot-style).
-- A teacher hosts a game with a join code; students join, the server runs each
-- question on a timer, and speed-weighted scoring produces a live leaderboard.
-- All state transitions are server-side; the browser only polls for state and
-- posts its own answer. Correct answers are never sent before a question's
-- reveal phase.

-- Teachers get game accounts too. student_id is really the login id: the
-- student ID# for students, the email prefix for teachers.
alter table play_accounts add column if not exists role text not null default 'student';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'play_accounts_role_check') then
    alter table play_accounts add constraint play_accounts_role_check check (role in ('student', 'teacher'));
  end if;
end $$;

create table if not exists play_live_games (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  host_id uuid not null references play_accounts(id) on delete cascade,
  subject text not null,
  topic text,
  question_count integer not null,
  seconds_per_question integer not null default 20 check (seconds_per_question between 5 and 120),
  status text not null default 'lobby' check (status in ('lobby', 'question', 'reveal', 'ended')),
  current_index integer not null default -1,
  question_started_at timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
-- A join code identifies exactly one game that is still running.
create unique index if not exists play_live_games_open_code_idx on play_live_games (code) where status <> 'ended';
create index if not exists play_live_games_host_idx on play_live_games (host_id, created_at desc);

create table if not exists play_live_questions (
  game_id uuid not null references play_live_games(id) on delete cascade,
  question_id uuid not null references play_questions(id) on delete cascade,
  order_index integer not null,
  primary key (game_id, question_id)
);

create table if not exists play_live_players (
  game_id uuid not null references play_live_games(id) on delete cascade,
  account_id uuid not null references play_accounts(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (game_id, account_id)
);

create table if not exists play_live_answers (
  game_id uuid not null references play_live_games(id) on delete cascade,
  account_id uuid not null references play_accounts(id) on delete cascade,
  question_id uuid not null references play_questions(id) on delete cascade,
  answer text not null,
  correct boolean not null,
  points integer not null,
  response_ms integer not null,
  answered_at timestamptz not null default now(),
  primary key (game_id, account_id, question_id)
);
