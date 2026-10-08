-- Puts the passwords back in their old columns, restores the old start check, and removes the new pieces.
begin;
drop trigger if exists divert_exam_access_password on public.draft_exams;
drop trigger if exists divert_exam_access_password on public.final_exams;
drop trigger if exists forget_exam_access_password on public.draft_exams;
drop trigger if exists forget_exam_access_password on public.final_exams;
update public.draft_exams d set access_password = p.password from public.exam_access_passwords p where p.exam_kind = 'draft' and p.exam_id = d.id;
update public.final_exams f set access_password = p.password from public.exam_access_passwords p where p.exam_kind = 'final' and p.exam_id = f.id;

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
$function$;

drop function if exists public.exam_password_unlocked(text, uuid);
drop function if exists public.verify_exam_password(text, uuid, text);
drop function if exists public.exam_access_password(text, uuid);
drop function if exists public.divert_exam_access_password();
drop function if exists public.forget_exam_access_password();
drop table if exists public.exam_password_checks;
drop table if exists public.exam_access_passwords;
commit;
select 'Migration 097 rolled back' as result;
