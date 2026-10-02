-- Teacher substitution, Stage 2: HOD and school-admin tools.
--
--   * An HOD (for teachers in their own department) or a school admin (for any teacher) can mark a teacher
--     absent for them. The same automation as Stage 1 then fills the teacher's classes.
--   * A review board of upcoming and past cover, scoped to the caller: an HOD sees their department, an admin
--     sees the school.
--   * Swap a different free teacher into a class, or retry a class nobody could cover.
--   * A count of upcoming classes still without a substitute, for the menu badge.
--
-- LESSONS
--   Every substituted class still needs a lesson (Stage 1's rule). When an HOD marks someone absent they pick
--   a lesson plan (an HOD can read any teacher's plans, but Smart Learning lessons stay private to their author).
--   A school admin can pick either a lesson plan or a published Smart Learning lesson (admins can read both).
--
-- WHAT CHANGES FROM STAGE 1
--   The "who is free and least loaded" rule used to live inside submit_teacher_absence(). It now lives in one
--   place, substitution_candidates(), shared by the self-report, the HOD/admin path, and the swap/retry, so they
--   can never disagree. submit_teacher_absence() keeps its name, arguments and behaviour; it now calls the shared
--   internal function substitution_submit().
--
-- Nothing is deleted. One new nullable column. Run after 073. Roll back with
-- scripts/migrations/rollback/074_substitution_hod_admin_tools_rollback.sql

begin;

alter table public.substitution_assignments add column if not exists unfilled_notified_at timestamptz;

-- ---- internal helpers (not callable by clients) ---------------------------------------------------------------

-- Teachers who could cover one class on one day, lightest load first. "Free" means: nothing in the timetable at
-- that day and period, not on leave themselves, and not already covering another class in that same period.
create or replace function public.substitution_candidates(p_date date, p_period_id uuid, p_exclude uuid)
returns table (cand_id uuid, cand_name text, day_load int)
language sql security definer
set search_path = public, pg_temp
as $$
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
$$;

-- May the caller mark this teacher absent? An admin: any active teacher or HOD. An HOD: only their department.
create or replace function public.substitution_can_mark(p_teacher uuid)
returns boolean
language sql security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles t
    where t.id = p_teacher
      and t.role in ('teacher', 'supervisor')
      and coalesce(t.is_active, true)
      and not t.is_system_admin
      and (
        public.is_admin()
        or (public.my_role() = 'supervisor' and t.department_id is not null and t.department_id = public.my_supervised_department())
      )
  );
$$;

-- May the caller change this assignment? An admin: any. An HOD: where the class belongs to their department,
-- or the absent teacher does.
create or replace function public.substitution_can_manage(p_assignment_id uuid)
returns boolean
language sql security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from substitution_assignments sa
    join timetable_sections s on s.id = sa.section_id
    join teacher_absences a on a.id = sa.absence_id
    join profiles tp on tp.id = a.teacher_id
    cross join (select public.my_supervised_department() as dept) me
    where sa.id = p_assignment_id
      and (
        public.is_admin()
        or (public.my_role() = 'supervisor' and me.dept is not null and (s.department_id = me.dept or tp.department_id = me.dept))
      )
  );
$$;

-- The engine. p_teacher is whose classes are being covered, p_actor is who pressed the button, and p_mode is
-- 'self' (the teacher themselves), 'hod' or 'admin'. It decides which lessons may be attached:
--   self  the teacher's own lesson plans and published Smart Learning lessons
--   hod   any lesson plan (an HOD can read them all); never a Smart Learning lesson
--   admin any lesson plan or published Smart Learning lesson
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

-- ---- Stage 1's entry point, same name and arguments, now using the shared engine ------------------------------

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
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  return public.substitution_submit(auth.uid(), auth.uid(), 'self', p_start_date, p_end_date, p_period_ids, p_lessons);
end;
$$;

-- ---- HOD and admin entry points ---------------------------------------------------------------------------------

-- Mark someone else absent.
create or replace function public.submit_absence_for_teacher(
  p_teacher_id uuid,
  p_start_date date,
  p_end_date date,
  p_period_ids uuid[] default null,
  p_lessons jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if not public.substitution_can_mark(p_teacher_id) then
    raise exception 'You can only mark teachers in your own department absent.' using errcode = '42501';
  end if;
  return public.substitution_submit(
    p_teacher_id, auth.uid(), case when public.is_admin() then 'admin' else 'hod' end,
    p_start_date, p_end_date, p_period_ids, p_lessons
  );
end;
$$;

-- The teachers the caller may mark absent.
create or replace function public.substitution_staff_list()
returns table (staff_id uuid, staff_name text, staff_role text, department_name text)
language sql security definer
set search_path = public, pg_temp
as $$
  select t.id, t.full_name, t.role, d.name
  from profiles t
  left join departments d on d.id = t.department_id
  where public.substitution_can_mark(t.id) and t.id <> auth.uid()
  order by t.full_name;
$$;

-- The classes a teacher has in a date range (so the screen can ask for one lesson per class).
create or replace function public.substitution_teacher_sections(
  p_teacher_id uuid, p_start_date date, p_end_date date, p_period_ids uuid[] default null
)
returns table (section_id uuid, subject text, period_id uuid, period_name text, period_order int, class_name text, day_of_week int)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
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
$$;

-- ---- review board, swap, retry, badge ---------------------------------------------------------------------------

-- Cover in a date range, scoped to the caller (an HOD sees their department, an admin sees the school).
create or replace function public.substitution_board(p_from date, p_to date)
returns table (
  assignment_id uuid, absence_id uuid, class_date date, subject text, period_name text, period_order int,
  class_name text, absent_id uuid, absent_name text, substitute_id uuid, substitute_name text,
  status text, lesson_label text, department_name text
)
language sql security definer
set search_path = public, pg_temp
as $$
  select sa.id, sa.absence_id, sa.class_date, s.subject, p.name, p.order_index, cg.name,
         a.teacher_id, tp.full_name, sa.substitute_teacher_id, sub.full_name, sa.status,
         coalesce(lp.topic || ' (lesson plan)', ll.title || ' (Smart Learning)'), d.name
  from substitution_assignments sa
  join timetable_sections s on s.id = sa.section_id
  join timetable_periods p on p.id = s.period_id
  join teacher_absences a on a.id = sa.absence_id
  join profiles tp on tp.id = a.teacher_id
  left join profiles sub on sub.id = sa.substitute_teacher_id
  left join class_groups cg on cg.id = s.class_group_id
  left join lesson_plans lp on lp.id = sa.lesson_plan_id
  left join learning_lessons ll on ll.id = sa.learning_lesson_id
  left join departments d on d.id = s.department_id
  cross join (select public.my_supervised_department() as dept) me
  where sa.class_date between p_from and p_to
    and (
      public.is_admin()
      or (public.my_role() = 'supervisor' and me.dept is not null and (s.department_id = me.dept or tp.department_id = me.dept))
    )
  order by sa.class_date, p.order_index, tp.full_name;
$$;

-- How many upcoming classes in the caller's scope still have no substitute (the menu badge).
create or replace function public.substitution_unfilled_count()
returns integer
language sql security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from substitution_assignments sa
  join timetable_sections s on s.id = sa.section_id
  join teacher_absences a on a.id = sa.absence_id
  join profiles tp on tp.id = a.teacher_id
  cross join (select public.my_supervised_department() as dept) me
  where sa.status = 'unfilled'
    and sa.class_date >= public.school_today()
    and (
      public.is_admin()
      or (public.my_role() = 'supervisor' and me.dept is not null and (s.department_id = me.dept or tp.department_id = me.dept))
    );
$$;

-- Who could be swapped in for one upcoming class.
create or replace function public.substitution_options(p_assignment_id uuid)
returns table (teacher_id uuid, teacher_name text, day_load int)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
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
$$;

-- Swap a substitute in (p_teacher_id given), or retry the automation (p_teacher_id null).
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

-- ---- who may call what ------------------------------------------------------------------------------------------

revoke execute on function
  public.substitution_candidates(date, uuid, uuid),
  public.substitution_can_mark(uuid),
  public.substitution_can_manage(uuid),
  public.substitution_submit(uuid, uuid, text, date, date, uuid[], jsonb)
from public, anon, authenticated;

revoke execute on function
  public.submit_absence_for_teacher(uuid, date, date, uuid[], jsonb),
  public.substitution_staff_list(),
  public.substitution_teacher_sections(uuid, date, date, uuid[]),
  public.substitution_board(date, date),
  public.substitution_unfilled_count(),
  public.substitution_options(uuid),
  public.reassign_substitute(uuid, uuid)
from public, anon;

grant execute on function
  public.submit_absence_for_teacher(uuid, date, date, uuid[], jsonb),
  public.substitution_staff_list(),
  public.substitution_teacher_sections(uuid, date, date, uuid[]),
  public.substitution_board(date, date),
  public.substitution_unfilled_count(),
  public.substitution_options(uuid),
  public.reassign_substitute(uuid, uuid)
to authenticated;

commit;
