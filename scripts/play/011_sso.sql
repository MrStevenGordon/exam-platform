-- Smart Assess Play: sign in through the exam login (no game passwords).
--
-- A Play account is now tied to the person's exam account by exam_user_id, and has no password of its
-- own. The exam login proves who they are; the server then creates or updates the matching Play account
-- (src/lib/playSso.ts). Only what a game needs is stored: ID#, display name, grade, school, role, classes.
--
-- Accounts made earlier by scripts/play/provision_from_roster.mjs are adopted on first sign-in (matched by
-- ID#) and their shared game password is removed.
-- Roll back with scripts/play/rollback/011_sso_rollback.sql.

alter table play_accounts add column if not exists exam_user_id uuid;
create unique index if not exists play_accounts_exam_user_idx on play_accounts (exam_user_id) where exam_user_id is not null;
alter table play_accounts alter column password_hash drop not null;

-- With no password, the game-password login can never succeed for such an account
-- (crypt() of a null hash is null, so the comparison is never true). Made explicit here:
create or replace function play_verify_login(p_student_id text, p_password text)
returns table (id uuid, student_id text, display_name text, grade_level integer, school text)
language sql
security definer
as $$
  select a.id, a.student_id, a.display_name, a.grade_level, a.school
  from play_accounts a
  where a.student_id = p_student_id
    and a.is_active
    and a.password_hash is not null
    and a.password_hash = crypt(p_password, a.password_hash);
$$;
