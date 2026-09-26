-- Rolls back 011. Accounts that have no password (created by exam sign-in) cannot be given one back,
-- so they are given an unusable random hash: they cannot use the game-password login, which is what
-- they could not do before either. Accounts with an exam_user_id keep it only until the column goes.
begin;
update play_accounts set password_hash = crypt(gen_random_uuid()::text, gen_salt('bf')) where password_hash is null;
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
alter table play_accounts alter column password_hash set not null;
drop index if exists play_accounts_exam_user_idx;
alter table play_accounts drop column if exists exam_user_id;
commit;
