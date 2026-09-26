-- 069: a read-only "teacher view" for school leadership.
--
-- Lets the school admin, principal / vice principal and heads of department see what one teacher has set and how
-- their marking stands, without loosening the security rules on the underlying tables:
--   * school admin, principal and vice principal: any teacher or HOD in the school
--   * HOD: teachers and HODs in their own department only
--   * everyone else (teachers, students, signed-out): refused
-- Unpublished drafts stay private: only a COUNT of them is shown, never their titles or questions. Lesson plans are
-- not touched at all (they stay private to their author).
--
-- Adds functions only. Nothing existing changes. Roll back with scripts/migrations/rollback/069_leadership_teacher_view_rollback.sql

begin;

-- May the caller look at this teacher?
create or replace function public.leadership_can_view_teacher(p_teacher uuid)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  me profiles;
  target profiles;
begin
  select * into me from profiles where id = auth.uid();
  if not found or coalesce(me.is_active, true) = false then return false; end if;
  select * into target from profiles where id = p_teacher;
  if not found or target.role not in ('teacher', 'supervisor') then return false; end if;
  if me.id = target.id then return true; end if;
  if me.role in ('admin', 'principal') or coalesce(me.is_system_admin, false) then return true; end if;
  if me.role = 'supervisor' then
    return public.my_supervised_department() is not null and target.department_id = public.my_supervised_department();
  end if;
  return false;
end;
$$;

-- The teachers the caller may look at, with their subjects and classes.
create or replace function public.leadership_teachers()
returns table (id uuid, full_name text, role text, department_name text, is_active boolean, subjects text[], classes text[])
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  me profiles;
  v_dept uuid := public.my_supervised_department();
begin
  select * into me from profiles where profiles.id = auth.uid();
  if not found or coalesce(me.is_active, true) = false then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if not (me.role in ('admin', 'principal', 'supervisor') or coalesce(me.is_system_admin, false)) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if me.role = 'supervisor' and v_dept is null then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select p.id, p.full_name, p.role, d.name,
         coalesce(p.is_active, true),
         coalesce((select array_agg(distinct ts.subject order by ts.subject) from teacher_subjects ts where ts.teacher_id = p.id), '{}'),
         coalesce((select array_agg(distinct cg.name order by cg.name) from teacher_class_groups tcg join class_groups cg on cg.id = tcg.class_group_id where tcg.teacher_id = p.id), '{}')
    from profiles p
    left join departments d on d.id = p.department_id
   where p.role in ('teacher', 'supervisor')
     and coalesce(p.is_system_admin, false) = false
     and (me.role <> 'supervisor' or coalesce(me.is_system_admin, false) or p.department_id = v_dept)
   order by p.full_name;
end;
$$;

-- Who they are, what they teach, and headline numbers.
create or replace function public.leadership_teacher_overview(p_teacher uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  p profiles;
  dept text;
  awaiting int;
begin
  if not public.leadership_can_view_teacher(p_teacher) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select * into p from profiles where id = p_teacher;
  select name into dept from departments where id = p.department_id;
  select count(*)::int into awaiting from public.leadership_marking_sessions(p_teacher);
  return jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'role', p.role, 'department_name', dept, 'is_active', coalesce(p.is_active, true),
    'last_seen_at', p.active_login_last_seen_at,
    'subjects', coalesce((select jsonb_agg(distinct ts.subject order by ts.subject) from teacher_subjects ts where ts.teacher_id = p_teacher), '[]'::jsonb),
    'classes', coalesce((select jsonb_agg(jsonb_build_object('name', cg.name, 'year_grade', cg.year_grade) order by cg.name)
                           from teacher_class_groups tcg join class_groups cg on cg.id = tcg.class_group_id where tcg.teacher_id = p_teacher), '[]'::jsonb),
    'live_assessments', (select count(*)::int from draft_exams d where d.created_by = p_teacher and coalesce(d.direct_published, false)),
    'unpublished_drafts', (select count(*)::int from draft_exams d where d.created_by = p_teacher and not coalesce(d.direct_published, false)),
    'awaiting_marking', awaiting
  );
end;
$$;

-- The submitted sessions a teacher is responsible for marking that are not fully marked yet.
-- Direct exams: the ones they created (or were chosen as grader for). Final exams: the ones they were chosen to
-- grade, or where they teach that student that subject (the same rule the marking screens use).
create or replace function public.leadership_marking_sessions(p_teacher uuid)
returns table (session_id uuid, kind text, exam_id uuid, title text, exam_kind text, subject text, completed_at timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id, 'direct', d.id, d.title, d.exam_kind, d.subject, s.completed_at
    from exam_sessions s join draft_exams d on d.id = s.draft_exam_id
   where s.status = 'completed' and not s.fully_graded and (d.created_by = p_teacher or s.assigned_teacher_id = p_teacher)
  union all
  select s.id, 'final', f.id, f.title, coalesce(f.exam_category, 'final'), f.subject, s.completed_at
    from exam_sessions s join final_exams f on f.id = s.final_exam_id
   where s.status = 'completed' and not s.fully_graded
     and (s.assigned_teacher_id = p_teacher or public.is_class_subject_teacher(p_teacher, s.student_id, f.subject))
$$;
revoke execute on function public.leadership_marking_sessions(uuid) from public, anon, authenticated;

-- Everything they have published for students (tests, quizzes, homework, assignments) and how it is going.
create or replace function public.leadership_teacher_assessments(p_teacher uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.leadership_can_view_teacher(p_teacher) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'unpublished_drafts', (select count(*)::int from draft_exams d where d.created_by = p_teacher and not coalesce(d.direct_published, false)),
    'items', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select d.id, d.title, d.exam_kind, d.subject, d.target_grade, d.created_at, d.available_from, d.available_until, d.direct_published_at,
               coalesce((select jsonb_agg(cg.name order by cg.name) from draft_exam_class_groups dcg join class_groups cg on cg.id = dcg.class_group_id where dcg.draft_exam_id = d.id), '[]'::jsonb) as classes,
               (select count(distinct e.student_id)::int from draft_exam_class_groups dcg join enrollments e on e.class_group_id = dcg.class_group_id where dcg.draft_exam_id = d.id) as expected,
               (select count(*)::int from exam_sessions s where s.draft_exam_id = d.id) as started,
               (select count(*)::int from exam_sessions s where s.draft_exam_id = d.id and s.status = 'completed') as submitted,
               (select count(*)::int from exam_sessions s where s.draft_exam_id = d.id and s.status = 'completed' and not s.fully_graded) as awaiting,
               (select round(avg(100.0 * s.total_score / nullif(s.max_possible_score, 0)), 1) from exam_sessions s where s.draft_exam_id = d.id and s.status = 'completed' and s.fully_graded and s.max_possible_score > 0) as average_pct,
               case when d.available_from is not null and d.available_from > now() then 'upcoming'
                    when d.available_until is not null and d.available_until < now() then 'closed'
                    else 'open' end as state
          from draft_exams d
         where d.created_by = p_teacher and coalesce(d.direct_published, false)
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- What is waiting to be marked, how long it has waited, and how much they have marked recently.
create or replace function public.leadership_teacher_marking(p_teacher uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.leadership_can_view_teacher(p_teacher) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'awaiting_total', (select count(*)::int from public.leadership_marking_sessions(p_teacher)),
    'oldest_waiting_at', (select min(completed_at) from public.leadership_marking_sessions(p_teacher)),
    'marked_last_30_days', (select count(*)::int from responses r where r.graded_by = p_teacher and r.graded_at >= now() - interval '30 days'),
    'items', coalesce((
      select jsonb_agg(x order by x.oldest_waiting_at) from (
        select m.kind, m.exam_id as id, m.title, m.exam_kind, m.subject, count(*)::int as waiting, min(m.completed_at) as oldest_waiting_at
          from public.leadership_marking_sessions(p_teacher) m
         group by m.kind, m.exam_id, m.title, m.exam_kind, m.subject
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.leadership_can_view_teacher(uuid) from public, anon;
revoke execute on function public.leadership_teachers() from public, anon;
revoke execute on function public.leadership_teacher_overview(uuid) from public, anon;
revoke execute on function public.leadership_teacher_assessments(uuid) from public, anon;
revoke execute on function public.leadership_teacher_marking(uuid) from public, anon;
grant execute on function public.leadership_can_view_teacher(uuid) to authenticated;
grant execute on function public.leadership_teachers() to authenticated;
grant execute on function public.leadership_teacher_overview(uuid) to authenticated;
grant execute on function public.leadership_teacher_assessments(uuid) to authenticated;
grant execute on function public.leadership_teacher_marking(uuid) to authenticated;

commit;
