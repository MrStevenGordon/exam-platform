-- 083: student results by topic (Smart Assess).
--
-- One secured function, my_topic_results(), that gives a signed-in STUDENT the raw material for their own "My topics" page:
-- for every question in an exam they finished AND whose results the teacher has released, the topic it belongs to, the
-- points they earned and the points it was worth. All the arithmetic happens in the app (src/lib/studentTopicsPure.ts).
--
-- WHAT IT NEVER RETURNS: question wording, options, correct answers, the student's answers or anything about other students.
-- Only topic names, marks and question ids (so a "Practise this topic" button can build a mock from past questions, which the
-- existing self-mock rules still check one by one).
--
-- RULES
--   * only the caller's own sessions, only completed, only results_released = true (nothing is shown before the teacher shares it)
--   * a question not yet marked (an essay waiting for its teacher) has no points yet and is left out, never counted as zero
--   * a topic that was merged into another counts as the topic it became
--   * questions with no topic are not returned, only counted, so the page can say topics are missing
--   * teachers, principals, inactive accounts and signed-out callers are refused
--
-- Needs the topic list (migration 058). Adds functions only; nothing existing changes and nothing is written.
-- Roll back with scripts/migrations/rollback/083_student_topics_rollback.sql

begin;

do $$
begin
  if to_regclass('public.curriculum_topics') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'topic_id') then
    raise exception 'Apply migration 058 (the topic list) first.';
  end if;
end $$;

-- Tiny probe so the app can hide "My topics" until this migration is installed.
create or replace function public.student_topics_ready()
returns boolean
language sql immutable
as $$ select true $$;

create or replace function public.my_topic_results()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  me profiles;
  v_rows jsonb;
  v_untagged int;
begin
  select * into me from profiles where id = auth.uid();
  if not found or coalesce(me.is_active, true) = false or me.role <> 'student' then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  with src as (
    select s.completed_at, coalesce(s.draft_exam_id, s.final_exam_id) as exam_id,
           coalesce(d.subject, f.subject) as subject,
           q.id as question_id, q.question_type, q.points, r.points_awarded,
           t.id as topic_id, t.name as topic_name, nullif(btrim(q.topic), '') as topic_text
      from exam_sessions s
      join responses r on r.session_id = s.id
      join questions q on q.id = r.question_id
      left join draft_exams d on d.id = s.draft_exam_id
      left join final_exams f on f.id = s.final_exam_id
      left join curriculum_topics raw on raw.id = q.topic_id
      left join curriculum_topics t on t.id = coalesce(raw.merged_into, q.topic_id)
     where s.student_id = me.id
       and s.status = 'completed'
       and s.results_released = true
       and r.points_awarded is not null
       and coalesce(q.points, 0) > 0
  )
  select (select count(*) from src where topic_id is null and topic_text is null)::int,
         coalesce((select jsonb_agg(jsonb_build_array(x.subject, x.topic_id, x.topic_name, x.topic_text, x.points_awarded, x.points,
                                                       x.completed_at, x.exam_id, x.question_id, x.question_type)
                                    order by x.completed_at desc)
                     from (select * from src where topic_id is not null or topic_text is not null
                            order by completed_at desc limit 3000) x), '[]'::jsonb)
    into v_untagged, v_rows;

  return jsonb_build_object('version', 1, 'rows', v_rows, 'untagged', v_untagged);
end;
$$;

revoke all on function public.my_topic_results() from public, anon;
grant execute on function public.my_topic_results() to authenticated;
grant execute on function public.student_topics_ready() to authenticated;

commit;
select 'Migration 083 applied' as result;
