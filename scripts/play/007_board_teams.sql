-- Smart Assess Play: team mode for Jeopardy boards.
-- In a team game, each student is on one team (balanced automatically as they
-- join; the teacher can shuffle or move players in the lobby). A buzz belongs
-- to the student's team: points go to the team, and a wrong answer locks the
-- whole team out of that clue. Individual (non-team) games are unchanged.

alter table play_board_games add column if not exists team_mode boolean not null default false;

create table if not exists play_board_teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references play_board_games(id) on delete cascade,
  position integer not null,
  name text not null,
  unique (game_id, position)
);

alter table play_board_players add column if not exists team_id uuid references play_board_teams(id) on delete set null;
alter table play_board_buzzes add column if not exists team_id uuid references play_board_teams(id) on delete set null;

-- A team gets at most one attempt at a clue, so a wrong answer locks all of
-- its members out.
create unique index if not exists play_board_buzzes_one_per_team_idx on play_board_buzzes (clue_id, team_id) where team_id is not null;
