-- Teacher substitution: cancelling an absence that was marked by mistake or that is no longer needed.
--
--   cancel_teacher_absence(absence_id)   Removes the cover for today and every later day of the absence. Days that
--                                        have already passed stay on record. If the absence had not started yet it is
--                                        removed completely; if it was already running, it is ended yesterday.
--
-- Who may call it: the absent teacher, an admin, or an HOD for a teacher in their department (the same people who
-- can mark an absence). Substitutes who had been given a class are told in their inbox that they are free, and the
-- absent teacher is told when somebody else cancelled for them. The function hands back the list of classes it
-- released so the app can send the matching emails.
--
-- Nothing existing is changed; one new function. Run after 075. Roll back with
-- scripts/migrations/rollback/076_cancel_absence_rollback.sql

begin;

create or replace function public.cancel_teacher_absence(p_absence_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_today date := public.school_today();
  v_abs record;
  v_ids uuid[];
  v_released jsonb;
  v_actor_name text;
  v_who uuid;
  v_body text;
  v_total int;
begin
  if v_actor is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;

  select a.id, a.teacher_id, a.start_date, a.end_date, tp.full_name as teacher_name, tp.department_id into v_abs
  from teacher_absences a
  join profiles tp on tp.id = a.teacher_id
  where a.id = p_absence_id;
  if v_abs.id is null then raise exception 'Absence not found.' using errcode = 'P0001'; end if;

  if not (
    v_abs.teacher_id = v_actor
    or public.is_admin()
    or (public.my_role() = 'supervisor' and v_abs.department_id is not null and v_abs.department_id = public.my_supervised_department())
  ) then
    raise exception 'You cannot cancel this absence.' using errcode = '42501';
  end if;

  if v_abs.end_date < v_today then
    raise exception 'That absence is already over, so it stays on record.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from substitution_assignments where absence_id = p_absence_id and class_date >= v_today;

  -- What is being released, captured before the rows go.
  select coalesce(jsonb_agg(jsonb_build_object(
           'substitute_id', sa.substitute_teacher_id, 'class_date', sa.class_date,
           'period_name', p.name, 'subject', s.subject, 'class_name', cg.name
         ) order by sa.class_date, p.order_index), '[]'::jsonb)
    into v_released
  from substitution_assignments sa
  join timetable_sections s on s.id = sa.section_id
  join timetable_periods p on p.id = s.period_id
  left join class_groups cg on cg.id = s.class_group_id
  where sa.id = any(v_ids) and sa.status = 'assigned' and sa.substitute_teacher_id is not null;

  select full_name into v_actor_name from profiles where id = v_actor;

  -- Inbox: each substitute who had a class, in date and period order. Nobody is messaged by themselves.
  for v_who in
    select distinct n.sid from public.substitution_notice_rows(v_ids) n where n.sid is not null and n.sid <> v_actor
  loop
    select count(*) into v_total from public.substitution_notice_rows(v_ids) n where n.sid = v_who;
    select 'Cover cancelled. ' || v_abs.teacher_name || ' is no longer absent, so you do not need to take:' || E'\n'
           || string_agg(q.what, E'\n' order by q.rn)
      into v_body
      from (select * from public.substitution_notice_rows(v_ids) n where n.sid = v_who order by n.rn limit 25) q;
    if v_total > 25 then v_body := v_body || E'\n' || 'and ' || (v_total - 25) || ' more.'; end if;
    perform public.substitution_send_message(v_actor, v_who, v_body);
  end loop;

  if v_abs.teacher_id <> v_actor and coalesce(array_length(v_ids, 1), 0) > 0 then
    perform public.substitution_send_message(
      v_actor, v_abs.teacher_id,
      'Your absence was cancelled by ' || coalesce(v_actor_name, 'a colleague') || '. Your classes are back with you and any cover for them has been removed.'
    );
  end if;

  delete from substitution_assignments where id = any(v_ids);

  if v_abs.start_date >= v_today then
    delete from teacher_absences where id = p_absence_id;
  else
    update teacher_absences set end_date = v_today - 1 where id = p_absence_id;
  end if;

  return jsonb_build_object(
    'cancelled_classes', coalesce(array_length(v_ids, 1), 0),
    'absent_id', v_abs.teacher_id,
    'absent_name', v_abs.teacher_name,
    'cancelled_by_other', v_abs.teacher_id <> v_actor,
    'released', v_released
  );
end;
$$;

revoke execute on function public.cancel_teacher_absence(uuid) from public, anon;
grant execute on function public.cancel_teacher_absence(uuid) to authenticated;

commit;

-- Only reached when everything above committed. If this row does not appear, nothing was applied.
select 'Migration 076 applied' as result;
