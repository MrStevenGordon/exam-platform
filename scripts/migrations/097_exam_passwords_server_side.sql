-- 097: exam passwords are checked on the server, and students can no longer read them.
--
-- WHAT WAS WRONG (QA B-020, 2026-10-07): the password lived in a column on the exam row, which students may read (that is how they see the exam), and the
-- student page compared what they typed in the browser. So a student could read every password in their class before the teacher gave it out, and the
-- database never checked the password at all (a student could even start a sitting directly without it).
--
-- NOW:
--  * The password moves to its own staff-only table (exam_access_passwords). The old column stays but is always empty; anything that writes a password to
--    it (the teacher's Publish button, publish_final_exam) is quietly redirected to the new table by a trigger, so those keep working unchanged.
--  * Staff read it with exam_access_password(kind, exam): the exam's teacher, the head of its department, the school admin, or a team lead for it.
--  * A student checks a password with verify_exam_password(kind, exam, typed). It answers ok / wrong / locked (8 wrong tries locks that student out of that
--    exam for 10 minutes) and never reveals the password.
--  * Starting a sitting now requires that the password was verified (exam_session_start_problem), so the check cannot be skipped by calling the database
--    directly. Group projects and exams with no password are unchanged. Changing an exam's password cancels earlier unlocks.
--
-- ORDER OF ROLLOUT: apply this at a quiet time and push the matching code straight after (the student start pages and the teacher/HOD password displays
-- changed). Between the two, a student could not unlock a password-protected test and a teacher would not see the password.
--
-- Roll back with scripts/migrations/rollback/097_exam_passwords_server_side_rollback.sql

begin;

create table if not exists public.exam_access_passwords (
  exam_kind  text not null check (exam_kind in ('draft', 'final')),
  exam_id    uuid not null,
  password   text not null,
  updated_at timestamptz not null default now(),
  primary key (exam_kind, exam_id)
);
alter table public.exam_access_passwords enable row level security;
revoke all on public.exam_access_passwords from public, anon, authenticated;

create table if not exists public.exam_password_checks (
  student_id     uuid not null,
  exam_kind      text not null check (exam_kind in ('draft', 'final')),
  exam_id        uuid not null,
  failed         integer not null default 0,
  last_failed_at timestamptz,
  unlocked_at    timestamptz,
  primary key (student_id, exam_kind, exam_id)
);
alter table public.exam_password_checks enable row level security;
revoke all on public.exam_password_checks from public, anon, authenticated;

-- move the existing passwords, then empty the old columns
insert into public.exam_access_passwords (exam_kind, exam_id, password)
  select 'draft', id, access_password from public.draft_exams where nullif(btrim(access_password), '') is not null
  on conflict do nothing;
insert into public.exam_access_passwords (exam_kind, exam_id, password)
  select 'final', id, access_password from public.final_exams where nullif(btrim(access_password), '') is not null
  on conflict do nothing;

-- Anything that writes a password into the old column lands in the new table instead (and an empty write changes nothing).
create or replace function public.divert_exam_access_password() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  k text := tg_argv[0];
  pw text := nullif(btrim(coalesce(new.access_password, '')), '');
  changed boolean;
begin
  if pw is not null then
    select not exists (select 1 from exam_access_passwords where exam_kind = k and exam_id = new.id and password = pw) into changed;
    if changed then
      insert into exam_access_passwords (exam_kind, exam_id, password) values (k, new.id, pw)
        on conflict (exam_kind, exam_id) do update set password = excluded.password, updated_at = now();
      delete from exam_password_checks where exam_kind = k and exam_id = new.id;   -- a new password: earlier unlocks no longer count
    end if;
  end if;
  new.access_password := null;
  return new;
end $$;

create or replace function public.forget_exam_access_password() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  delete from exam_access_passwords where exam_kind = tg_argv[0] and exam_id = old.id;
  delete from exam_password_checks where exam_kind = tg_argv[0] and exam_id = old.id;
  return old;
end $$;

drop trigger if exists divert_exam_access_password on public.draft_exams;
create trigger divert_exam_access_password before insert or update of access_password on public.draft_exams
  for each row execute function public.divert_exam_access_password('draft');
drop trigger if exists divert_exam_access_password on public.final_exams;
create trigger divert_exam_access_password before insert or update of access_password on public.final_exams
  for each row execute function public.divert_exam_access_password('final');
drop trigger if exists forget_exam_access_password on public.draft_exams;
create trigger forget_exam_access_password after delete on public.draft_exams
  for each row execute function public.forget_exam_access_password('draft');
drop trigger if exists forget_exam_access_password on public.final_exams;
create trigger forget_exam_access_password after delete on public.final_exams
  for each row execute function public.forget_exam_access_password('final');

update public.draft_exams set access_password = null where access_password is not null;
update public.final_exams set access_password = null where access_password is not null;

-- ---------- staff read the password ----------
create or replace function public.exam_access_password(p_kind text, p_exam uuid) returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  d draft_exams; f final_exams; ok boolean := false; pw text;
begin
  if auth.uid() is null then return null; end if;
  if p_kind = 'draft' then
    select * into d from draft_exams where id = p_exam;
    if not found then return null; end if;
    ok := d.created_by = auth.uid()
       or public.is_admin()
       or (d.department_id is not null and d.department_id = public.my_supervised_department())
       or exists (select 1 from team_lead_appointments t where t.teacher_id = auth.uid() and t.subject = d.subject and t.year_grade = d.target_grade);
  elsif p_kind = 'final' then
    select * into f from final_exams where id = p_exam;
    if not found then return null; end if;
    ok := public.is_admin() or (f.department_id is not null and f.department_id = public.my_supervised_department());
  end if;
  if not coalesce(ok, false) then return null; end if;   -- coalesce: a NULL here (e.g. no department) must mean "no", not "yes"
  select password into pw from exam_access_passwords where exam_kind = p_kind and exam_id = p_exam;
  return pw;
end $$;
revoke all on function public.exam_access_password(text, uuid) from public, anon;
grant execute on function public.exam_access_password(text, uuid) to authenticated;

-- ---------- a student checks a password ----------
create or replace function public.verify_exam_password(p_kind text, p_exam uuid, p_password text) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  stored text; c exam_password_checks; visible boolean := false;
begin
  if me is null or not public.exam_caller_is_student() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_kind = 'final' then
    visible := exists (select 1 from final_exams f where f.id = p_exam and f.status = 'published') and public.student_can_see_final_exam(p_exam);
  elsif p_kind = 'draft' then
    visible := exists (select 1 from draft_exams d join draft_exam_class_groups dcg on dcg.draft_exam_id = d.id join enrollments e on e.class_group_id = dcg.class_group_id
                        where d.id = p_exam and d.direct_published and e.student_id = me);
  else
    raise exception 'Unknown exam type.' using errcode = 'P0001';
  end if;
  if not visible then raise exception 'This exam is not available to you.' using errcode = '42501'; end if;

  select password into stored from exam_access_passwords where exam_kind = p_kind and exam_id = p_exam;
  select * into c from exam_password_checks where student_id = me and exam_kind = p_kind and exam_id = p_exam;
  if c.failed >= 8 and c.last_failed_at > now() - interval '10 minutes' then return 'locked'; end if;

  if stored is null or upper(btrim(coalesce(p_password, ''))) = upper(stored) then
    insert into exam_password_checks (student_id, exam_kind, exam_id, failed, unlocked_at) values (me, p_kind, p_exam, 0, now())
      on conflict (student_id, exam_kind, exam_id) do update set failed = 0, unlocked_at = now();
    return 'ok';
  end if;

  insert into exam_password_checks (student_id, exam_kind, exam_id, failed, last_failed_at) values (me, p_kind, p_exam, 1, now())
    on conflict (student_id, exam_kind, exam_id) do update
      set failed = case when exam_password_checks.last_failed_at is null or exam_password_checks.last_failed_at < now() - interval '10 minutes' then 1 else exam_password_checks.failed + 1 end,
          last_failed_at = now();
  return 'wrong';
end $$;
revoke all on function public.verify_exam_password(text, uuid, text) from public, anon;
grant execute on function public.verify_exam_password(text, uuid, text) to authenticated;

-- used by the start check below; not callable from the app
create or replace function public.exam_password_unlocked(p_kind text, p_exam uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select not exists (select 1 from exam_access_passwords p where p.exam_kind = p_kind and p.exam_id = p_exam)
      or exists (select 1 from exam_password_checks c where c.student_id = auth.uid() and c.exam_kind = p_kind and c.exam_id = p_exam and c.unlocked_at is not null)
$$;
revoke all on function public.exam_password_unlocked(text, uuid) from public, anon, authenticated;

-- ---------- starting a sitting needs the password ----------
create or replace function public.exam_session_start_problem(p_final uuid, p_draft uuid, p_group uuid, p_limit integer, p_teacher uuid)
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  fe final_exams;
  d draft_exams;
  relaxed boolean;
begin
  if (p_final is null) = (p_draft is null) then return 'This exam could not be found.'; end if;

  if p_final is not null then
    select * into fe from final_exams where id = p_final;
    if not found or fe.status <> 'published' or not public.student_can_see_final_exam(p_final) then return 'This exam is not available to you.'; end if;
    if fe.available_from is not null and now() < fe.available_from then return 'This exam is not open yet.'; end if;
    if fe.available_until is not null and now() > fe.available_until then return 'This exam has closed.'; end if;
    if p_group is not null then return 'This exam cannot be sat as a group.'; end if;
    if p_limit is null or p_limit < 0 or p_limit > coalesce(fe.duration_minutes, 0) * 60 then return 'The time limit does not match this exam.'; end if;
    if p_teacher is not null and not exists (select 1 from teacher_subjects ts where ts.teacher_id = p_teacher and ts.subject = fe.subject) then
      return 'That teacher does not mark this subject.';
    end if;
    if not public.exam_password_unlocked('final', p_final) then return 'Enter the exam password first.'; end if;
    return null;
  end if;

  select * into d from draft_exams where id = p_draft;
  if not found or not coalesce(d.direct_published, false)
     or not exists (select 1 from draft_exam_class_groups dcg join enrollments e on e.class_group_id = dcg.class_group_id where dcg.draft_exam_id = p_draft and e.student_id = auth.uid()) then
    return 'This exam is not available to you.';
  end if;
  if d.available_from is not null and now() < d.available_from then return 'This exam is not open yet.'; end if;
  if d.available_until is not null and now() > d.available_until then return 'This exam has closed.'; end if;
  if p_teacher is not null then return 'A grading teacher cannot be chosen for this exam.'; end if;
  if exists (select 1 from exam_sessions s where s.draft_exam_id = p_draft and s.student_id = auth.uid()) then return 'You have already started this exam.'; end if;

  if p_group is not null then
    -- A group project's hand-in: the student must belong to that exam's group. It has no time limit.
    if p_limit is not null then return 'The time limit does not match this exam.'; end if;
    if not exists (select 1 from project_group_members m join project_groups g on g.id = m.group_id where m.group_id = p_group and m.student_id = auth.uid() and g.draft_exam_id = p_draft) then
      return 'You are not in a group for this exam.';
    end if;
    return null;
  end if;

  relaxed := d.exam_kind in ('homework', 'assignment');
  if relaxed then
    if p_limit is not null and (p_limit < 0 or p_limit > 604800) then return 'The time limit does not match this exam.'; end if;
  elsif p_limit is null or p_limit < 0 or p_limit > coalesce(d.duration_minutes, 0) * 60 then
    return 'The time limit does not match this exam.';
  end if;
  if not public.exam_password_unlocked('draft', p_draft) then return 'Enter the exam password first.'; end if;
  return null;
end;
$function$;

commit;

select 'Migration 097 applied' as result;
