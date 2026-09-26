-- 067: exam integrity, stage 3 (see docs/exam-integrity-findings.md)
--
-- Locks what a student can do to exam data with their own login. Before this, the security rules gave a
-- student full access to their own exam sessions and responses, and let them read the answer key of every
-- question on their own exams. After this:
--   * a student cannot read `questions` for an exam they are sitting or are about to sit
--     (the app gets questions without answers from student_exam_questions, added in 066);
--   * a student can only START a session for an exam that is open to them, with the time limit the exam
--     sets and a start time set by the database (not by the browser);
--   * a student can save answers while the session is open, and can never write marks, scores, the
--     completed status (except a group project's own hand-in), the release flag or anyone else's data;
--   * a student cannot delete sessions or responses;
--   * the completed-exam practice policy only opens a question once results are released.
-- Marks are written only by student_submit_exam (066), which runs as the database owner and so passes these guards.
--
-- ORDER OF ROLLOUT (each step is safe on its own; do not skip ahead):
--   1. apply 066            (adds functions only)
--   2. deploy the app that uses them (it falls back to the old behaviour until 066 exists)
--   3. check an exam end to end as a student, THEN apply 067
-- Do NOT apply 067 while an exam is being sat: an open page from the old app would fail at submit.
-- Roll back with scripts/migrations/rollback/067_exam_integrity_lock_rollback.sql.
--
-- Not changed here (a separate decision): the question bank's student read policy (048) and the bank
-- clause of is_question_eligible_for_self_mock (047). See docs/exam-integrity-findings.md, finding E5.

begin;

-- ---- lookups the guards need (run as the owner so they can read tables a student cannot) ----------------

-- Returns NULL if the caller may start a session with these values, otherwise the reason it is refused.
create or replace function public.exam_session_start_problem(p_final uuid, p_draft uuid, p_group uuid, p_limit int, p_teacher uuid)
returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
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
  return null;
end;
$$;

-- True when the caller is known to be someone other than a student (teacher, HOD, admin, ...). The guards below
-- let those callers through and treat everyone else, including a deactivated student or a login with no profile,
-- as a student.
create or replace function public.exam_caller_is_staff()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select exists (select 1 from profiles where id = auth.uid() and role <> 'student') $$;

-- Is this the caller's own session, still in progress?
create or replace function public.exam_session_is_open(p_session uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select exists (select 1 from exam_sessions where id = p_session and student_id = auth.uid() and status = 'in_progress') $$;

-- Does this question belong to the exam that session is for?
create or replace function public.exam_session_has_question(p_session uuid, p_question uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from exam_sessions s
     where s.id = p_session and s.student_id = auth.uid()
       and (
         (s.final_exam_id is not null and exists (select 1 from final_exam_questions f where f.final_exam_id = s.final_exam_id and f.question_id = p_question))
         or (s.draft_exam_id is not null and exists (select 1 from questions q where q.id = p_question and q.draft_exam_id = s.draft_exam_id))
       )
  )
$$;

revoke execute on function public.exam_session_start_problem(uuid, uuid, uuid, int, uuid) from public, anon;
revoke execute on function public.exam_caller_is_staff() from public, anon;
revoke execute on function public.exam_session_is_open(uuid) from public, anon;
revoke execute on function public.exam_session_has_question(uuid, uuid) from public, anon;
grant execute on function public.exam_session_start_problem(uuid, uuid, uuid, int, uuid) to authenticated;
grant execute on function public.exam_caller_is_staff() to authenticated;
grant execute on function public.exam_session_is_open(uuid) to authenticated;
grant execute on function public.exam_session_has_question(uuid, uuid) to authenticated;

-- ---- exam_sessions ------------------------------------------------------------------------------------------
-- These guards only act for a student using the public API (database role authenticated/anon). Staff, the
-- server's service role, and the owner-run functions (student_submit_exam) pass straight through. They run as
-- the caller (not security definer) so current_user tells them who is asking.

create or replace function public.exam_sessions_student_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  problem text;
begin
  if current_user not in ('authenticated', 'anon') or public.exam_caller_is_staff() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Exam sessions cannot be deleted.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.student_id is distinct from auth.uid() then raise exception 'Not allowed.' using errcode = '42501'; end if;
    if new.status <> 'in_progress' or new.completed_at is not null or new.total_score is not null or new.max_possible_score is not null
       or coalesce(new.fully_graded, false) or new.results_released or new.results_notified_at is not null or new.flagged
       or coalesce(new.tab_switch_count, 0) <> 0 or (new.violation_log is not null and new.violation_log <> '[]'::jsonb)
       or new.file_submission_url is not null or new.file_submission_name is not null
       or new.contribution_statement is not null or new.contribution_integrity_signals is not null then
      raise exception 'A new exam session must start empty.' using errcode = '42501';
    end if;
    problem := public.exam_session_start_problem(new.final_exam_id, new.draft_exam_id, new.group_id, new.time_limit_seconds, new.assigned_teacher_id);
    if problem is not null then raise exception '%', problem using errcode = '42501'; end if;
    new.started_at := now();   -- the clock is the database's, not the browser's
    return new;
  end if;

  -- UPDATE
  if old.status = 'completed' then raise exception 'This exam has already been submitted.' using errcode = '42501'; end if;
  if (to_jsonb(new) - array['tab_switch_count', 'flagged', 'password_verified', 'file_submission_url', 'file_submission_name',
                            'contribution_statement', 'contribution_integrity_signals', 'status', 'completed_at'])
     is distinct from
     (to_jsonb(old) - array['tab_switch_count', 'flagged', 'password_verified', 'file_submission_url', 'file_submission_name',
                            'contribution_statement', 'contribution_integrity_signals', 'status', 'completed_at']) then
    raise exception 'That part of an exam session cannot be changed.' using errcode = '42501';
  end if;
  if coalesce(new.tab_switch_count, 0) < coalesce(old.tab_switch_count, 0) or (old.flagged and not new.flagged) then
    raise exception 'That part of an exam session cannot be reduced.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    -- Only a group project's own hand-in is completed by the student; every other exam goes through student_submit_exam.
    if old.group_id is null or new.status <> 'completed' then raise exception 'An exam is submitted with the submit button.' using errcode = '42501'; end if;
    new.completed_at := now();
  elsif new.completed_at is distinct from old.completed_at then
    raise exception 'That part of an exam session cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists exam_sessions_student_guard on public.exam_sessions;
create trigger exam_sessions_student_guard
  before insert or update or delete on public.exam_sessions
  for each row execute function public.exam_sessions_student_guard();

-- ---- responses ----------------------------------------------------------------------------------------------

create or replace function public.responses_student_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.exam_caller_is_staff() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Answers cannot be deleted.' using errcode = '42501';
  end if;

  if not public.exam_session_is_open(new.session_id) then
    raise exception 'This exam is not open for answers.' using errcode = '42501';
  end if;
  if length(coalesce(new.answer, '')) > 100000 or length(coalesce(new.working, '')) > 100000 then
    raise exception 'That answer is too long.' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    if not public.exam_session_has_question(new.session_id, new.question_id) then
      raise exception 'That question is not part of this exam.' using errcode = '42501';
    end if;
    if new.points_awarded is not null or new.graded_by is not null or new.graded_at is not null or new.ai_review is not null or new.integrity_signals is not null then
      raise exception 'Marks are set by the exam system, not by the student.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: only the answer and the working may change
  if (to_jsonb(new) - array['answer', 'working']) is distinct from (to_jsonb(old) - array['answer', 'working']) then
    raise exception 'Marks are set by the exam system, not by the student.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists responses_student_guard on public.responses;
create trigger responses_student_guard
  before insert or update or delete on public.responses
  for each row execute function public.responses_student_guard();

-- ---- questions: the answer key stays off the student's device -------------------------------------------------

drop policy if exists "Students view questions for their enrolled exams" on public.questions;

-- The practice-mock policy opened a question as soon as the student had submitted its exam. Open it only once
-- the teacher has released the results, which is when the student sees the answers in their review anyway.
create or replace function public.student_completed_question_exam(q_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from questions q
    join exam_sessions s on s.draft_exam_id = q.draft_exam_id
    where q.id = q_id
      and s.student_id = auth.uid()
      and s.status = 'completed'
      and s.results_released = true
  ) or exists (
    select 1
    from final_exam_questions feq
    join exam_sessions s on s.final_exam_id = feq.final_exam_id
    where feq.question_id = q_id
      and s.student_id = auth.uid()
      and s.status = 'completed'
      and s.results_released = true
  );
$$;

commit;
