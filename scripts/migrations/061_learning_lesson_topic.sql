-- Lets the student lesson page know which curriculum topic a lesson belongs to, so it can offer
-- "Practise this topic in Smart Play". Only the topic's name and subject are returned.
--
-- This replaces learning_get_lesson() from 059 with the same function plus one extra field,
-- 'topic' ({name, subject}, or null when the lesson has no topic). Nothing else changes: still
-- only the lesson text and links, never the teacher's approval flags.
--
-- Requires 058 and 059.
-- Roll back with scripts/migrations/rollback/061_learning_lesson_topic_rollback.sql

begin;

create or replace function public.learning_get_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_access text := public.learning_student_access(p_lesson_id);
  l learning_lessons;
  v_teacher text;
  v_due date;
  v_prog learning_progress;
  v_topic jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_access = 'none' then raise exception 'This lesson is not available to you.' using errcode = '42501'; end if;
  if v_access = 'closed' then raise exception 'This lesson closed after its due date.' using errcode = 'P0001'; end if;
  select * into l from learning_lessons where id = p_lesson_id;
  select full_name into v_teacher from profiles where id = l.teacher_id;
  select min(a.due_date) into v_due from learning_assignments a
   where a.lesson_id = p_lesson_id and exists (select 1 from enrollments e where e.student_id = auth.uid() and e.class_group_id = a.class_group_id);
  select * into v_prog from learning_progress where lesson_id = p_lesson_id and student_id = auth.uid();
  -- A topic that was merged into another counts as the topic it became; an archived one is left out.
  select jsonb_build_object('name', t.name, 'subject', t.subject) into v_topic
    from curriculum_topics t
   where t.id = coalesce((select m.merged_into from curriculum_topics m where m.id = l.topic_id), l.topic_id)
     and t.status <> 'archived';
  return jsonb_build_object(
    'id', l.id, 'title', l.title, 'subject', l.subject, 'grade', l.grade,
    'teacher_name', v_teacher, 'due_date', v_due, 'key_terms', l.key_terms,
    'topic', v_topic,
    -- Only what students need: text and links, never the approval flags.
    'steps', (select jsonb_agg(jsonb_build_object('key', s ->> 'key', 'text', s ->> 'text', 'resources', s -> 'resources') order by ord)
                from jsonb_array_elements(l.steps) with ordinality as x(s, ord)),
    'steps_done', to_jsonb(coalesce(v_prog.steps_done, '{}'::text[])),
    'completed_at', v_prog.completed_at
  );
end;
$$;

revoke execute on function public.learning_get_lesson(uuid) from public, anon;
grant execute on function public.learning_get_lesson(uuid) to authenticated;

commit;
