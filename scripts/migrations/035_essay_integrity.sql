-- Extends the existing heuristic essay-integrity system (useIntegrityCapture.ts,
-- responses.integrity_signals, already surfaced to teachers) with a place to
-- store an on-demand LLM second opinion.
alter table public.responses add column ai_review jsonb;

-- Supervisors currently only see responses/sessions for final_exam-linked
-- (formal) exams -- there's no equivalent policy for draft_exam-linked
-- (direct/practice) exams, even though draft_exams.department_id exists and
-- "questions" already got this exact fix. Without this, a department-wide
-- flagged-essay dashboard silently returns nothing for a supervisor's
-- direct-exam essays.
create policy "Supervisors view responses for own department direct exams" on public.responses
  for select using (
    exists (
      select 1 from exam_sessions
      join draft_exams on draft_exams.id = exam_sessions.draft_exam_id
      where exam_sessions.id = responses.session_id
      and (draft_exams.department_id = my_supervised_department() or is_admin())
    )
  );

create policy "Supervisors view sessions for own department direct exams" on public.exam_sessions
  for select using (
    exists (
      select 1 from draft_exams
      where draft_exams.id = exam_sessions.draft_exam_id
      and (draft_exams.department_id = my_supervised_department() or is_admin())
    )
  );
