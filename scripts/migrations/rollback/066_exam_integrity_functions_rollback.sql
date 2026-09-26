-- Removes the exam integrity functions and puts append_violation_log back as it was.
-- Only roll this back if migration 067 has been rolled back first (067 depends on these).
begin;
drop function if exists public.student_exam_review(text, uuid);
drop function if exists public.student_submit_exam(uuid, jsonb, jsonb, jsonb, boolean);
drop function if exists public.student_exam_questions(text, uuid);
drop function if exists public.student_exam_meta(text, uuid);
drop function if exists public.exam_own_session(text, uuid);
drop function if exists public.score_answer(text, int, text, jsonb, text);
drop function if exists public.grade_multi_point(int, jsonb, text[]);
drop function if exists public.exam_trim(text);
drop function if exists public.exam_submit_grace_seconds();

-- the version that existed before (no ownership check)
create or replace function public.append_violation_log(session_id uuid, entry jsonb)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update exam_sessions
  set violation_log = coalesce(violation_log, '[]'::jsonb) || entry::jsonb
  where id = session_id;
$function$;

drop function if exists public.exam_caller_is_student();
commit;
