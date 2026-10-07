-- Rolls back 089: the substitution functions go back to looking at one period only (as in 073 to 075).
begin;

drop function if exists public.substitution_candidates(date, uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.substitution_candidates(p_date date, p_period_id uuid, p_exclude uuid)
 RETURNS TABLE(cand_id uuid, cand_name text, day_load integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select t.id, t.full_name,
         ((select count(*) from timetable_sections o2
            where o2.teacher_id = t.id
              and o2.day_of_week = extract(isodow from p_date)::int
              and o2.academic_year = public.school_year_for(p_date))
          + (select count(*) from substitution_assignments sa2
              where sa2.substitute_teacher_id = t.id and sa2.class_date = p_date))::int as day_load
  from profiles t
  where t.role in ('teacher', 'supervisor', 'principal')
    and coalesce(t.is_active, true)
    and t.id <> p_exclude
    and not exists (
      select 1 from timetable_sections o
      where o.teacher_id = t.id
        and o.day_of_week = extract(isodow from p_date)::int
        and o.period_id = p_period_id
        and o.academic_year = public.school_year_for(p_date)
    )
    and not exists (
      select 1 from teacher_absences a
      where a.teacher_id = t.id and p_date between a.start_date and a.end_date
        and (a.period_ids is null or p_period_id = any(a.period_ids))
    )
    and not exists (
      select 1 from substitution_assignments sa
      join timetable_sections s2 on s2.id = sa.section_id
      where sa.substitute_teacher_id = t.id and sa.class_date = p_date and s2.period_id = p_period_id
    )
  order by day_load, t.full_name;
$function$;

CREATE OR REPLACE FUNCTION public.substitution_submit(p_teacher uuid, p_actor uuid, p_mode text, p_start_date date, p_end_date date, p_period_ids uuid[], p_lessons jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_aid uuid;
  v_ids uuid[] := '{}';
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
            assigned_at = now(), unfilled_notified_at = null
      returning id into v_aid;

      v_ids := v_ids || v_aid;

      v_results := v_results || jsonb_build_object(
        'class_date', v_date, 'section_id', v_section.id, 'subject', v_section.subject,
        'period_name', v_section.period_name, 'status', v_status, 'substitute_name', v_sub_name
      );

      v_sub_id := null;
      v_sub_name := null;
    end loop;

    v_date := v_date + 1;
  end loop;

  perform public.substitution_notify_inbox(v_ids, p_actor);

  return jsonb_build_object('absence_id', v_absence_id, 'results', v_results);
end;
$function$;

CREATE OR REPLACE FUNCTION public.substitution_teacher_sections(p_teacher_id uuid, p_start_date date, p_end_date date, p_period_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(section_id uuid, subject text, period_id uuid, period_name text, period_order integer, class_name text, day_of_week integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if not public.substitution_can_mark(p_teacher_id) then
    raise exception 'You can only mark teachers in your own department absent.' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date - p_start_date > 30 then
    raise exception 'Choose a valid date range.' using errcode = 'P0001';
  end if;
  return query
  select distinct s.id, s.subject, s.period_id, p.name, p.order_index, cg.name, s.day_of_week::int
  from generate_series(0, p_end_date - p_start_date) g(i)
  join timetable_sections s
    on s.teacher_id = p_teacher_id
   and s.day_of_week = extract(isodow from p_start_date + g.i)::int
   and s.academic_year = public.school_year_for(p_start_date + g.i)
  join timetable_periods p on p.id = s.period_id
  left join class_groups cg on cg.id = s.class_group_id
  where p_period_ids is null or s.period_id = any(p_period_ids)
  order by p.order_index, s.subject;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reassign_substitute(p_assignment_id uuid, p_teacher_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  perform public.substitution_notify_inbox(array[p_assignment_id], auth.uid(), v.current_sub);

  return jsonb_build_object('status', 'assigned', 'substitute_id', v_new, 'substitute_name', v_name);
end;
$function$;

CREATE OR REPLACE FUNCTION public.substitution_options(p_assignment_id uuid)
 RETURNS TABLE(teacher_id uuid, teacher_name text, day_load integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare
  v record;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if not public.substitution_can_manage(p_assignment_id) then
    raise exception 'You cannot change this class.' using errcode = '42501';
  end if;
  select sa.class_date, s.period_id, a.teacher_id as absent_id into v
  from substitution_assignments sa
  join timetable_sections s on s.id = sa.section_id
  join teacher_absences a on a.id = sa.absence_id
  where sa.id = p_assignment_id;
  if v.class_date < public.school_today() then return; end if;
  return query select c.cand_id, c.cand_name, c.day_load from public.substitution_candidates(v.class_date, v.period_id, v.absent_id) c;
end;
$function$;

commit;
select 'Migration 089 rolled back' as result;
