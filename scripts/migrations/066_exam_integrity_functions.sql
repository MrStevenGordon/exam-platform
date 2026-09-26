-- Exam integrity, stage 1 and 2: the server decides marks, and students stop seeing answers.
--
-- WHY (see docs/exam-integrity-findings.md)
--   Today the student's own browser downloads every question WITH its correct answer and marking guide,
--   works out each mark itself, and writes the marks and total score to the database. So a student can
--   read the answers and can set their own marks.
--
-- WHAT THIS ADDS (nothing existing is changed or removed, so the current app keeps working exactly as before)
--   grade_multi_point / score_answer   The marking rules from src/lib/grading.ts, in the database.
--   student_exam_meta                  How many questions an exam has (start pages), without exposing them.
--   student_exam_questions             An exam's questions WITHOUT correct answers or marking guides.
--   student_submit_exam                The server marks a submitted exam and completes the session.
--   student_exam_review                A student's own answers and the correct answers, ONLY once results
--                                      have been released.
--   append_violation_log               Now refuses to write to anyone else's session.
--
-- The app switches to these functions when they exist and keeps its old behaviour when they do not, so
-- this can be applied before or after the new app is deployed. Migration 067 (applied only after the
-- new app is confirmed working) is what removes the old student access.
--
-- Roll back with scripts/migrations/rollback/066_exam_integrity_functions_rollback.sql

begin;

-- ---- who is asking ---------------------------------------------------------------------------------

create or replace function public.exam_caller_is_student()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select exists (select 1 from profiles where id = auth.uid() and role = 'student' and coalesce(is_active, true)) $$;

-- How long after the time limit a submission is still accepted as the student typed it. It covers a
-- dropped connection at the deadline. After this, the answers already saved (autosave) are marked instead.
create or replace function public.exam_submit_grace_seconds()
returns int
language sql immutable
as $$ select 300 $$;

-- ---- marking: the rules in src/lib/grading.ts, exactly -----------------------------------------------------

-- JavaScript's trim() removes all whitespace including non-breaking spaces; so does this.
create or replace function public.exam_trim(p text)
returns text
language sql immutable
as $$ select regexp_replace(coalesce(p, ''), '^[\s ﻿]+|[\s ﻿]+$', '', 'g') $$;

-- gradeMultiPoint: every marking point whose keywords appear in ANY of the answers scores its marks;
-- the total is capped at the question's points.
create or replace function public.grade_multi_point(p_points int, p_marking jsonb, p_answers text[])
returns numeric
language plpgsql immutable
as $$
declare
  mp jsonb;
  kws jsonb;
  total numeric := 0;
  matched boolean;
begin
  if p_marking is null or jsonb_typeof(p_marking) <> 'array' or jsonb_array_length(p_marking) = 0 then return 0; end if;
  for mp in select jsonb_array_elements(p_marking) loop
    kws := mp -> 'keywords';
    if kws is null or jsonb_typeof(kws) <> 'array' or jsonb_array_length(kws) = 0 then continue; end if;
    select exists (
      select 1 from unnest(p_answers) a, jsonb_array_elements_text(kws) kw
       where position(lower(kw) in lower(public.exam_trim(a))) > 0
    ) into matched;
    if matched then total := total + coalesce((mp ->> 'marks')::numeric, 0); end if;
  end loop;
  return least(total, p_points);
end;
$$;

-- The submit path of the take-exam pages: a question with marking points is marked by keyword whatever
-- its type; otherwise gradeAnswer(): multiple choice, true/false, short answer and fill-in-the-blank are
-- compared with the correct answer, ignoring capitals and surrounding spaces; anything else (essays) is
-- left null for the teacher to mark.
create or replace function public.score_answer(p_type text, p_points int, p_correct text, p_marking jsonb, p_answer text)
returns numeric
language plpgsql immutable
as $$
declare
  answers text[];
begin
  p_answer := coalesce(p_answer, '');
  if p_marking is not null and jsonb_typeof(p_marking) = 'array' and jsonb_array_length(p_marking) > 0 then
    select coalesce(array_agg(t), '{}') into answers
      from (select public.exam_trim(x) as t from unnest(string_to_array(p_answer, E'\n')) x) s where t <> '';
    if cardinality(answers) = 0 then answers := array[p_answer]; end if;
    return public.grade_multi_point(p_points, p_marking, answers);
  end if;
  if p_type not in ('multiple_choice', 'true_false', 'short_answer', 'fill_blank') then return null; end if;
  if p_correct is null or p_correct = '' then return 0; end if;
  return case when lower(public.exam_trim(p_answer)) = lower(public.exam_trim(p_correct)) then p_points else 0 end;
end;
$$;

-- ---- finding the student's session ----------------------------------------------------------------------------

create or replace function public.exam_own_session(p_kind text, p_exam_id uuid)
returns exam_sessions
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  s exam_sessions;
begin
  if p_kind not in ('final', 'direct') then raise exception 'Unknown exam type.' using errcode = 'P0001'; end if;
  select * into s from exam_sessions
   where student_id = auth.uid() and ((p_kind = 'final' and final_exam_id = p_exam_id) or (p_kind = 'direct' and draft_exam_id = p_exam_id))
   order by started_at desc nulls last limit 1;
  return s;
end;
$$;
revoke execute on function public.exam_own_session(text, uuid) from public, anon, authenticated;

-- ---- what a student sees while sitting an exam ---------------------------------------------------------------------

-- How many questions an exam has, for the exam's front page. Only for exams the student may sit.
create or replace function public.student_exam_meta(p_kind text, p_exam_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  n int;
begin
  if not public.exam_caller_is_student() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_kind = 'final' then
    if not (exists (select 1 from final_exams f where f.id = p_exam_id and f.status = 'published') and public.student_can_see_final_exam(p_exam_id)) then
      raise exception 'This exam is not available to you.' using errcode = '42501';
    end if;
    select count(*)::int into n from final_exam_questions where final_exam_id = p_exam_id;
  elsif p_kind = 'direct' then
    if not exists (
      select 1 from draft_exams d join draft_exam_class_groups dcg on dcg.draft_exam_id = d.id join enrollments e on e.class_group_id = dcg.class_group_id
       where d.id = p_exam_id and d.direct_published and e.student_id = auth.uid()
    ) then raise exception 'This exam is not available to you.' using errcode = '42501'; end if;
    select count(*)::int into n from questions where draft_exam_id = p_exam_id;
  else
    raise exception 'Unknown exam type.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('question_count', n);
end;
$$;

-- The questions of an exam the student has STARTED, with everything needed to show them and nothing that
-- gives the answer away. Whether a question has marking points is a yes/no (it decides how many answer
-- boxes to draw); the points themselves stay on the server.
create or replace function public.student_exam_questions(p_kind text, p_exam_id uuid)
returns table (
  id uuid, question_type text, question_text text, points int, options jsonb, order_index int,
  has_marking_points boolean, total_marks int, section_id uuid, image_url text, audio_url text, video_url text, show_working boolean
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  s exam_sessions;
begin
  if not public.exam_caller_is_student() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  s := public.exam_own_session(p_kind, p_exam_id);
  if s.id is null then raise exception 'Start the exam first.' using errcode = '42501'; end if;
  if s.status <> 'in_progress' then raise exception 'This exam has already been submitted.' using errcode = 'P0001'; end if;

  if p_kind = 'final' then
    return query
    select q.id, q.question_type, q.question_text, q.points, q.options, feq.order_index,
           (q.marking_points is not null and jsonb_typeof(q.marking_points) = 'array' and jsonb_array_length(q.marking_points) > 0),
           q.total_marks, q.section_id, q.image_url, q.audio_url, q.video_url, q.show_working
      from final_exam_questions feq join questions q on q.id = feq.question_id
     where feq.final_exam_id = p_exam_id
     order by feq.order_index;
  else
    return query
    select q.id, q.question_type, q.question_text, q.points, q.options, q.order_index,
           (q.marking_points is not null and jsonb_typeof(q.marking_points) = 'array' and jsonb_array_length(q.marking_points) > 0),
           q.total_marks, q.section_id, q.image_url, q.audio_url, q.video_url, q.show_working
      from questions q
     where q.draft_exam_id = p_exam_id
     order by q.order_index;
  end if;
end;
$$;

-- ---- submitting an exam --------------------------------------------------------------------------------------------------

-- The student's answers go in; the server marks them and completes the session. Marks are computed here
-- from the answer key, never taken from the student's device.
--   p_answers    { "<question id>": "the answer" }
--   p_workings   { "<question id>": "working shown" }
--   p_integrity  { "<question id>": { "answer": {...}, "working": {...} } }   (recorded for the teacher only)
--   p_flagged    true if the browser noticed anything worth a teacher's attention
-- If the time limit (plus a short grace period) has passed the answers are still marked (so work done offline
-- is never lost) but the session is flagged and a late_submission entry is added to its violation log for the
-- teacher. Homework and assignments have no time limit. Submitting twice returns the first result and changes nothing.
create or replace function public.student_submit_exam(p_session_id uuid, p_answers jsonb, p_workings jsonb, p_integrity jsonb, p_flagged boolean)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s exam_sessions;
  d draft_exams;
  relaxed boolean := false;
  late boolean := false;
  q record;
  ans text;
  wrk text;
  awarded numeric;
  score numeric := 0;
  max_score numeric := 0;
  has_essay boolean := false;
begin
  if not public.exam_caller_is_student() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_workings, '{}'::jsonb)) <> 'object'
     or (p_integrity is not null and jsonb_typeof(p_integrity) <> 'object')
     or length(coalesce(p_answers::text, '')) + length(coalesce(p_workings::text, '')) + length(coalesce(p_integrity::text, '')) > 2000000 then
    raise exception 'Those answers could not be read.' using errcode = 'P0001';
  end if;

  select * into s from exam_sessions where id = p_session_id for update;
  if not found or s.student_id <> auth.uid() then raise exception 'Not allowed.' using errcode = '42501'; end if;

  if s.status = 'completed' then
    return jsonb_build_object('total_score', s.total_score, 'max_possible_score', s.max_possible_score, 'fully_graded', s.fully_graded, 'already_submitted', true);
  end if;

  if s.draft_exam_id is not null then
    select * into d from draft_exams where id = s.draft_exam_id;
    relaxed := d.exam_kind in ('homework', 'assignment');
  end if;
  if not relaxed and s.time_limit_seconds is not null and s.started_at is not null
     and now() > s.started_at + make_interval(secs => s.time_limit_seconds + public.exam_submit_grace_seconds()) then
    late := true;
  end if;

  -- A late submission is still marked (a student who worked offline and reconnects later must not lose their
  -- exam), but the session is flagged and the lateness is logged so the teacher can review it.
  if late then
    p_flagged := true;
    update exam_sessions
       set violation_log = coalesce(violation_log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
             'type', 'late_submission',
             'reason', 'Submitted ' || (extract(epoch from (now() - (s.started_at + make_interval(secs => s.time_limit_seconds))))::int) || ' seconds after the time limit',
             'timestamp', now()))
     where id = s.id;
  end if;

  delete from responses where session_id = s.id;

  for q in
    select qq.id, qq.question_type, qq.points, qq.correct_answer, qq.marking_points
      from (
        select x.id, x.question_type, x.points, x.correct_answer, x.marking_points, feq.order_index as ord
          from final_exam_questions feq join questions x on x.id = feq.question_id where feq.final_exam_id = s.final_exam_id
        union all
        select x.id, x.question_type, x.points, x.correct_answer, x.marking_points, x.order_index as ord
          from questions x where s.draft_exam_id is not null and x.draft_exam_id = s.draft_exam_id
      ) qq
     order by qq.ord
  loop
    ans := coalesce(p_answers ->> q.id::text, '');
    wrk := nullif(coalesce(p_workings ->> q.id::text, ''), '');
    awarded := public.score_answer(q.question_type, q.points, q.correct_answer, q.marking_points, ans);
    if awarded is null then has_essay := true; else score := score + awarded; end if;
    max_score := max_score + q.points;
    insert into responses (session_id, question_id, answer, working, points_awarded, graded_at, integrity_signals)
    values (s.id, q.id, ans, wrk, awarded, case when awarded is not null then now() end, p_integrity -> q.id::text)
    -- an autosave landing at the same instant must not make the submit fail
    on conflict (session_id, question_id) do update
      set answer = excluded.answer, working = excluded.working, points_awarded = excluded.points_awarded,
          graded_at = excluded.graded_at, integrity_signals = excluded.integrity_signals;
  end loop;

  update exam_sessions
     set status = 'completed', completed_at = now(), total_score = score, max_possible_score = max_score,
         fully_graded = not has_essay, flagged = flagged or coalesce(p_flagged, false)
   where id = s.id;

  return jsonb_build_object('total_score', score, 'max_possible_score', max_score, 'fully_graded', not has_essay, 'already_submitted', false, 'late', late);
end;
$$;

-- ---- reviewing a finished exam -------------------------------------------------------------------------------------------------

-- The student's own answers and marks, WITH the correct answers, but only after their results have been
-- released. Before that it returns nothing at all.
create or replace function public.student_exam_review(p_kind text, p_exam_id uuid)
returns table (
  response_id uuid, question_id uuid, order_index int, question_text text, question_type text, options jsonb,
  points int, correct_answer text, answer text, points_awarded numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  s exam_sessions;
begin
  if not public.exam_caller_is_student() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  s := public.exam_own_session(p_kind, p_exam_id);
  if s.id is null or s.status <> 'completed' or not s.results_released then return; end if;

  if p_kind = 'final' then
    return query
    select r.id, q.id, feq.order_index, q.question_text, q.question_type, q.options, q.points, q.correct_answer, r.answer, r.points_awarded
      from final_exam_questions feq join questions q on q.id = feq.question_id
      left join responses r on r.question_id = q.id and r.session_id = s.id
     where feq.final_exam_id = p_exam_id
     order by feq.order_index;
  else
    return query
    select r.id, q.id, q.order_index, q.question_text, q.question_type, q.options, q.points, q.correct_answer, r.answer, r.points_awarded
      from questions q left join responses r on r.question_id = q.id and r.session_id = s.id
     where q.draft_exam_id = p_exam_id
     order by q.order_index;
  end if;
end;
$$;

-- ---- the violation log: only your own session ---------------------------------------------------------------------------------

-- Was callable by any signed-in user against any session, so a student could plant entries on a
-- classmate's exam. Now it writes only to the caller's own in-progress session (staff are unchanged).
create or replace function public.append_violation_log(session_id uuid, entry jsonb)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if public.exam_caller_is_student() then
    update exam_sessions
       set violation_log = coalesce(violation_log, '[]'::jsonb) || entry::jsonb
     where id = session_id and student_id = auth.uid() and status = 'in_progress';
  else
    update exam_sessions
       set violation_log = coalesce(violation_log, '[]'::jsonb) || entry::jsonb
     where id = session_id;
  end if;
end;
$$;

revoke execute on function
  public.exam_caller_is_student(), public.student_exam_meta(text, uuid), public.student_exam_questions(text, uuid),
  public.student_submit_exam(uuid, jsonb, jsonb, jsonb, boolean), public.student_exam_review(text, uuid)
from public, anon;
grant execute on function
  public.exam_caller_is_student(), public.student_exam_meta(text, uuid), public.student_exam_questions(text, uuid),
  public.student_submit_exam(uuid, jsonb, jsonb, jsonb, boolean), public.student_exam_review(text, uuid)
to authenticated;

commit;
