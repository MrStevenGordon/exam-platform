-- Undoes migration 075 (Stage 3): drops the notification, My Cover and student functions and the five bookkeeping
-- columns, and puts substitution_submit() and reassign_substitute() back exactly as 074 defined them (no inbox
-- messages). Stages 1 and 2 keep working. Messages already sent stay in people's inboxes.
begin;

create or replace function public.substitution_submit(
  p_teacher uuid, p_actor uuid, p_mode text,
  p_start_date date, p_end_date date, p_period_ids uuid[], p_lessons jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_absence_id uuid;
  v_date date;
  v_dow int;
  v_year text;
  v_section record;
  v_lesson jsonb;
  v_lesson_plan_id uuid;
  v_learning_lesson_id uuid;
  v_has_lesson boolean;
  v_sub_id uuid;
  v_sub_name text;
  v_status text;
  v_results jsonb := '[]'::jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Choose a valid date range.' using errcode = 'P0001';
  end if;
  if p_end_date - p_start_date > 30 then
    raise exception 'Report up to 31 days at a time.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_lessons) is distinct from 'array' then
    raise exception 'Invalid lesson selection.' using errcode = 'P0001';
  end if;

  insert into teacher_absences (teacher_id, start_date, end_date, period_ids, created_by)
  values (p_teacher, p_start_date, p_end_date, p_period_ids, p_actor)
  returning id into v_absence_id;

  v_date := p_start_date;
  while v_date <= p_end_date loop
    v_dow := extract(isodow from v_date)::int;
    v_year := public.school_year_for(v_date);

    for v_section in
      select s.id, s.subject, s.period_id, p.name as period_name, p.order_index
      from timetable_sections s
      join timetable_periods p on p.id = s.period_id
      where s.teacher_id = p_teacher
        and s.day_of_week = v_dow
        and s.academic_year = v_year
        and (p_period_ids is null or s.period_id = any(p_period_ids))
      order by p.order_index
    loop
      v_lesson_plan_id := null;
      v_learning_lesson_id := null;
      v_has_lesson := false;
      for v_lesson in select * from jsonb_array_elements(p_lessons) loop
        if (v_lesson ->> 'section_id')::uuid = v_section.id then
          v_lesson_plan_id := nullif(v_lesson ->> 'lesson_plan_id', '')::uuid;
          v_learning_lesson_id := nullif(v_lesson ->> 'learning_lesson_id', '')::uuid;
          v_has_lesson := (v_lesson_plan_id is not null) or (v_learning_lesson_id is not null);
          exit;
        end if;
      end loop;
      if not v_has_lesson then
        raise exception 'Pick a lesson for % (%).', v_section.subject, v_section.period_name using errcode = 'P0001';
      end if;
      if v_lesson_plan_id is not null and not exists (
        select 1 from lesson_plans where id = v_lesson_plan_id and (p_mode <> 'self' or teacher_id = p_actor)
      ) then
        raise exception 'That lesson plan was not found.' using errcode = 'P0001';
      end if;
      if v_learning_lesson_id is not null then
        if p_mode = 'hod' then
          raise exception 'Choose a lesson plan for % (%).', v_section.subject, v_section.period_name using errcode = 'P0001';
        end if;
        if not exists (
          select 1 from learning_lessons
          where id = v_learning_lesson_id and status = 'published' and (p_mode <> 'self' or teacher_id = p_actor)
        ) then
          raise exception 'That lesson was not found.' using errcode = 'P0001';
        end if;
      end if;

      select c.cand_id, c.cand_name into v_sub_id, v_sub_name
      from public.substitution_candidates(v_date, v_section.period_id, p_teacher) c
      limit 1;

      v_status := case when v_sub_id is not null then 'assigned' else 'unfilled' end;

      insert into substitution_assignments (absence_id, section_id, class_date, lesson_plan_id, learning_lesson_id, substitute_teacher_id, status, assigned_by)
      values (v_absence_id, v_section.id, v_date, v_lesson_plan_id, v_learning_lesson_id, v_sub_id, v_status, p_actor)
      on conflict (section_id, class_date) do update
        set absence_id = excluded.absence_id, lesson_plan_id = excluded.lesson_plan_id, learning_lesson_id = excluded.learning_lesson_id,
            substitute_teacher_id = excluded.substitute_teacher_id, status = excluded.status, assigned_by = excluded.assigned_by,
            assigned_at = now(), unfilled_notified_at = null;

      v_results := v_results || jsonb_build_object(
        'class_date', v_date, 'section_id', v_section.id, 'subject', v_section.subject,
        'period_name', v_section.period_name, 'status', v_status, 'substitute_name', v_sub_name
      );

      v_sub_id := null;
      v_sub_name := null;
    end loop;

    v_date := v_date + 1;
  end loop;

  return jsonb_build_object('absence_id', v_absence_id, 'results', v_results);
end;
$$;

create or replace function public.reassign_substitute(p_assignment_id uuid, p_teacher_id uuid default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v record;
  v_new uuid;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if not public.substitution_can_manage(p_assignment_id) then
    raise exception 'You cannot change this class.' using errcode = '42501';
  end if;
  select sa.class_date, sa.substitute_teacher_id as current_sub, s.period_id, a.teacher_id as absent_id into v
  from substitution_assignments sa
  join timetable_sections s on s.id = sa.section_id
  join teacher_absences a on a.id = sa.absence_id
  where sa.id = p_assignment_id;
  if v.class_date < public.school_today() then
    raise exception 'That class has already happened.' using errcode = 'P0001';
  end if;

  if p_teacher_id is null then
    select c.cand_id, c.cand_name into v_new, v_name
    from public.substitution_candidates(v.class_date, v.period_id, v.absent_id) c
    limit 1;
    if v_new is null then
      return jsonb_build_object('status', 'unfilled', 'substitute_name', null);
    end if;
  else
    if p_teacher_id = v.current_sub then
      raise exception 'That teacher is already covering this class.' using errcode = 'P0001';
    end if;
    select c.cand_id, c.cand_name into v_new, v_name
    from public.substitution_candidates(v.class_date, v.period_id, v.absent_id) c
    where c.cand_id = p_teacher_id;
    if v_new is null then
      raise exception 'That teacher is not free for this period.' using errcode = 'P0001';
    end if;
  end if;

  update substitution_assignments
  set substitute_teacher_id = v_new, status = 'assigned', assigned_by = auth.uid(), assigned_at = now()
  where id = p_assignment_id;

  return jsonb_build_object('status', 'assigned', 'substitute_id', v_new, 'substitute_name', v_name);
end;
$$;

drop function if exists public.student_cover(date, date);
drop function if exists public.cover_lesson(uuid);
drop function if exists public.my_cover_count();
drop function if exists public.my_cover(date, date);
drop function if exists public.substitution_notify_inbox(uuid[], uuid, uuid);
drop function if exists public.substitution_notice_rows(uuid[]);
drop function if exists public.substitution_send_message(uuid, uuid, text);

alter table public.substitution_assignments
  drop column if exists reminded_at,
  drop column if exists absent_told_at,
  drop column if exists absent_told_id,
  drop column if exists substitute_notified_at,
  drop column if exists substitute_notified_id;

commit;
