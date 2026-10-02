-- Undoes migration 074 (Stage 2: HOD and admin tools): drops the new functions and column and puts Stage 1's
-- submit_teacher_absence() back exactly as 073 defined it. Stage 1 (073) is left in place and keeps working.
-- Existing substitution data is not touched.
begin;

create or replace function public.submit_teacher_absence(
  p_start_date date,
  p_end_date date,
  p_period_ids uuid[] default null,
  p_lessons jsonb default '[]'::jsonb
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
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
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
  values (auth.uid(), p_start_date, p_end_date, p_period_ids, auth.uid())
  returning id into v_absence_id;

  v_date := p_start_date;
  while v_date <= p_end_date loop
    v_dow := extract(isodow from v_date)::int;
    v_year := public.school_year_for(v_date);

    for v_section in
      select s.id, s.subject, s.period_id, p.name as period_name, p.order_index
      from timetable_sections s
      join timetable_periods p on p.id = s.period_id
      where s.teacher_id = auth.uid()
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
        select 1 from lesson_plans where id = v_lesson_plan_id and teacher_id = auth.uid()
      ) then
        raise exception 'That lesson plan was not found.' using errcode = 'P0001';
      end if;
      if v_learning_lesson_id is not null and not exists (
        select 1 from learning_lessons where id = v_learning_lesson_id and teacher_id = auth.uid() and status = 'published'
      ) then
        raise exception 'That lesson was not found.' using errcode = 'P0001';
      end if;

      select t.id, t.full_name into v_sub_id, v_sub_name
      from profiles t
      where t.role in ('teacher', 'supervisor', 'principal')
        and coalesce(t.is_active, true)
        and t.id <> auth.uid()
        and not exists (
          select 1 from timetable_sections o
          where o.teacher_id = t.id and o.day_of_week = v_dow and o.period_id = v_section.period_id and o.academic_year = v_year
        )
        and not exists (
          select 1 from teacher_absences a
          where a.teacher_id = t.id and v_date between a.start_date and a.end_date
            and (a.period_ids is null or v_section.period_id = any(a.period_ids))
        )
        and not exists (
          select 1 from substitution_assignments sa
          join timetable_sections s2 on s2.id = sa.section_id
          where sa.substitute_teacher_id = t.id and sa.class_date = v_date and s2.period_id = v_section.period_id
        )
      order by (
        (select count(*) from timetable_sections o2 where o2.teacher_id = t.id and o2.day_of_week = v_dow and o2.academic_year = v_year)
        + (select count(*) from substitution_assignments sa2 where sa2.substitute_teacher_id = t.id and sa2.class_date = v_date)
      ) asc, t.full_name asc
      limit 1;

      v_status := case when v_sub_id is not null then 'assigned' else 'unfilled' end;

      insert into substitution_assignments (absence_id, section_id, class_date, lesson_plan_id, learning_lesson_id, substitute_teacher_id, status, assigned_by)
      values (v_absence_id, v_section.id, v_date, v_lesson_plan_id, v_learning_lesson_id, v_sub_id, v_status, auth.uid())
      on conflict (section_id, class_date) do update
        set absence_id = excluded.absence_id, lesson_plan_id = excluded.lesson_plan_id, learning_lesson_id = excluded.learning_lesson_id,
            substitute_teacher_id = excluded.substitute_teacher_id, status = excluded.status, assigned_by = excluded.assigned_by, assigned_at = now();

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

drop function if exists public.reassign_substitute(uuid, uuid);
drop function if exists public.substitution_options(uuid);
drop function if exists public.substitution_unfilled_count();
drop function if exists public.substitution_board(date, date);
drop function if exists public.substitution_teacher_sections(uuid, date, date, uuid[]);
drop function if exists public.substitution_staff_list();
drop function if exists public.submit_absence_for_teacher(uuid, date, date, uuid[], jsonb);
drop function if exists public.substitution_submit(uuid, uuid, text, date, date, uuid[], jsonb);
drop function if exists public.substitution_can_manage(uuid);
drop function if exists public.substitution_can_mark(uuid);
drop function if exists public.substitution_candidates(date, uuid, uuid);

alter table public.substitution_assignments drop column if exists unfilled_notified_at;

commit;
