-- Smart Assess Play: classes, XP and daily streaks.
--
-- Classes are copied one way from the exam database by the provisioning script
-- (read-only there), so a class leaderboard means the students who are really
-- in that class and a teacher sees only the classes they teach.
--
-- XP and streaks are computed live from what students actually did; nothing is
-- stored, so they can never drift from the underlying answers. play_activity
-- is the single list of "things a student did", one row per answer or buzz:
--   practice / duel : 10 XP per question point earned
--   live quiz       : the live score divided by 100 (a fast correct answer is ~10)
--   jeopardy buzz   : the clue value divided by 10 when correct (100 -> 10 XP)
-- Wrong answers earn 0 XP but still count as playing that day for streaks.

create table if not exists play_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade_label text,
  source_class_id uuid not null unique
);

create table if not exists play_class_members (
  class_id uuid not null references play_classes(id) on delete cascade,
  account_id uuid not null references play_accounts(id) on delete cascade,
  primary key (class_id, account_id)
);
create index if not exists play_class_members_account_idx on play_class_members (account_id);

create table if not exists play_class_teachers (
  class_id uuid not null references play_classes(id) on delete cascade,
  account_id uuid not null references play_accounts(id) on delete cascade,
  primary key (class_id, account_id)
);
create index if not exists play_class_teachers_account_idx on play_class_teachers (account_id);

create index if not exists play_duel_answers_account_idx on play_duel_answers (account_id, answered_at);
create index if not exists play_live_answers_account_idx on play_live_answers (account_id, answered_at);
create index if not exists play_board_buzzes_account_idx on play_board_buzzes (account_id, buzzed_at);

create or replace view play_activity as
  select s.account_id, a.answered_at as occurred_at, (coalesce(a.points_awarded, 0) * 10)::int as xp, 'practice'::text as source
    from play_practice_answers a
    join play_practice_sessions s on s.id = a.session_id
   where a.answered_at is not null
  union all
  select d.account_id, d.answered_at, (d.points_awarded * 10)::int, 'duel'
    from play_duel_answers d
  union all
  select l.account_id, l.answered_at, round(l.points / 100.0)::int, 'live'
    from play_live_answers l
  union all
  select b.account_id, b.buzzed_at, case when b.outcome = 'correct' then c.value / 10 else 0 end, 'board'
    from play_board_buzzes b
    join play_board_clues c on c.id = b.clue_id;
