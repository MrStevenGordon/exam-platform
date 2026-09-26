-- Smart Assess Play: core schema for the SEPARATE games database.
-- Runs against the local stand-in Postgres (PLAY_DATABASE_URL) today and is
-- written as plain Postgres so it can move to a dedicated Supabase project
-- later. Never run this against the exam database.
--
-- Game accounts hold only what a game needs: the student's ID#, a display
-- name, grade, and a hashed game password. No exam data, no exam credentials.

create extension if not exists pgcrypto;

create table if not exists play_accounts (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique,
  display_name text not null,
  grade_level integer,
  school text,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Login attempts, so the API can throttle guessing against a student ID#.
create table if not exists play_login_attempts (
  id bigserial primary key,
  student_id text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists play_login_attempts_lookup_idx
  on play_login_attempts (student_id, attempted_at desc);

-- Returns the account on a correct ID#/password for an active account, else
-- no rows. Password check happens in the database (bcrypt via pgcrypto) so
-- the hash never leaves it.
create or replace function play_verify_login(p_student_id text, p_password text)
returns table (id uuid, student_id text, display_name text, grade_level integer, school text)
language sql
security definer
as $$
  select a.id, a.student_id, a.display_name, a.grade_level, a.school
  from play_accounts a
  where a.student_id = p_student_id
    and a.is_active
    and a.password_hash = crypt(p_password, a.password_hash);
$$;

-- True when this ID# has 5 or more failed attempts in the last 10 minutes
-- and no success since. Checked before verifying a password.
create or replace function play_login_locked(p_student_id text)
returns boolean
language sql
stable
as $$
  select count(*) >= 5
  from play_login_attempts t
  where t.student_id = p_student_id
    and not t.succeeded
    and t.attempted_at > now() - interval '10 minutes'
    and t.attempted_at > coalesce(
      (select max(s.attempted_at) from play_login_attempts s
       where s.student_id = p_student_id and s.succeeded),
      'epoch'::timestamptz
    );
$$;
