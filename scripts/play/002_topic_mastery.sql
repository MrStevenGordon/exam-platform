-- Smart Assess Play: Topic Mastery. Game questions live here, in the Play
-- database only. Correct answers are never sent to the browser before a
-- student answers; grading happens server-side in the API.

create table if not exists play_questions (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  topic text not null,
  question_type text not null check (question_type in ('multiple_choice', 'true_false', 'fill_blank', 'short_answer')),
  question_text text not null,
  options jsonb,
  correct_answer text not null,
  points integer not null default 1,
  explanation text,
  -- Set when copied from an exam-database bank question, so re-importing
  -- never duplicates. Null for questions authored directly for Play.
  source_question_id uuid unique,
  created_at timestamptz not null default now()
);
create index if not exists play_questions_subject_topic_idx on play_questions (subject, topic);

create table if not exists play_practice_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references play_accounts(id) on delete cascade,
  subject text not null,
  topic text not null,
  question_count integer not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score numeric,
  max_score numeric
);
create index if not exists play_practice_sessions_account_idx on play_practice_sessions (account_id, started_at desc);

create table if not exists play_practice_answers (
  session_id uuid not null references play_practice_sessions(id) on delete cascade,
  question_id uuid not null references play_questions(id) on delete cascade,
  order_index integer not null,
  answer text,
  points_awarded numeric,
  answered_at timestamptz,
  primary key (session_id, question_id)
);
