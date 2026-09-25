-- Puts learning_get_lesson() back to its 059 version (no 'topic' field).
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
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if v_access = 'none' then raise exception 'This lesson is not available to you.' using errcode = '42501'; end if;
  if v_access = 'closed' then raise exception 'This lesson closed after its due date.' using errcode = 'P0001'; end if;
  select * into l from learning_lessons where id = p_lesson_id;
  select full_name into v_teacher from profiles where id = l.teacher_id;
  select min(a.due_date) into v_due from learning_assignments a
   where a.lesson_id = p_lesson_id and exists (select 1 from enrollments e where e.student_id = auth.uid() and e.class_group_id = a.class_group_id);
  select * into v_prog from learning_progress where lesson_id = p_lesson_id and student_id = auth.uid();
  return jsonb_build_object(
    'id', l.id, 'title', l.title, 'subject', l.subject, 'grade', l.grade,
    'teacher_name', v_teacher, 'due_date', v_due, 'key_terms', l.key_terms,
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
