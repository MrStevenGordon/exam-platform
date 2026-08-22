-- Bug fix: publishing a supervisor-reviewed exam was four separate,
-- unguarded client-side inserts/updates (create final_exams row, copy
-- questions, link class groups, mark draft published). None of the last
-- three checked their error, so a failure partway through left a
-- final_exams row already marked 'published' -- with missing questions or
-- no class-group link -- while the UI still reported success and handed
-- out an access password for a broken exam.
--
-- Wraps the same four steps in one SECURITY DEFINER function so they
-- either all succeed or the whole thing rolls back, matching the pattern
-- already used for staff-chat writes (see 027_staff_chat.sql).

create or replace function public.publish_final_exam(
  p_draft_exam_id uuid,
  p_class_group_ids uuid[],
  p_access_password text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_draft record;
  v_final_exam_id uuid;
  v_group_id uuid;
begin
  select * into v_draft from draft_exams where id = p_draft_exam_id;
  if not found then
    raise exception 'Exam not found';
  end if;

  if not (
    public.is_admin()
    or v_draft.department_id = public.my_supervised_department()
  ) then
    raise exception 'Not authorized to publish this exam';
  end if;

  if array_length(p_class_group_ids, 1) is null or array_length(p_class_group_ids, 1) = 0 then
    raise exception 'Select at least one class group';
  end if;

  insert into final_exams (
    title, subject, instructions, duration_minutes, status, department_id,
    exam_category, access_password, published_at, questions_per_page,
    target_grade, calculator_enabled, created_by
  ) values (
    v_draft.title, v_draft.subject, v_draft.instructions, v_draft.duration_minutes, 'published',
    v_draft.department_id, v_draft.exam_kind, p_access_password, now(), v_draft.questions_per_page,
    v_draft.target_grade, v_draft.calculator_enabled, auth.uid()
  )
  returning id into v_final_exam_id;

  insert into final_exam_questions (final_exam_id, question_id, order_index)
  select v_final_exam_id, q.id, q.order_index
  from questions q
  where q.draft_exam_id = p_draft_exam_id;

  foreach v_group_id in array p_class_group_ids loop
    insert into final_exam_class_groups (final_exam_id, class_group_id)
    values (v_final_exam_id, v_group_id);
  end loop;

  update draft_exams
  set status = 'published', access_password = p_access_password, published_final_exam_id = v_final_exam_id
  where id = p_draft_exam_id;

  return v_final_exam_id;
end;
$$;
