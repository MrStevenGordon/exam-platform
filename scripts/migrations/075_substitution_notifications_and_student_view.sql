-- Teacher substitution, Stage 3: telling people, and letting students and substitutes see cover.
--
--   * IN-APP MESSAGES. When cover is arranged or changed, the substitute gets a message in their Messages inbox
--     (so they see the unread badge and browser pop-up they already have). Every inbox message needs a real sender,
--     so it is sent by whoever arranged the cover: the absent teacher for a self-report, the HOD or admin otherwise.
--     A swapped-out substitute is told they are released. When an HOD or admin arranged the cover, the absent
--     teacher is told who is taking each class. Nobody is ever messaged by themselves.
--   * MY COVER. my_cover() lists the classes the caller is covering, my_cover_count() counts the upcoming ones (the
--     menu badge), and cover_lesson() returns the attached lesson so a substitute can read it. Teachers cannot
--     normally read each other's lesson plans, so this is the one narrow way in: only for a class the caller is
--     covering (or their own absence, or an HOD/admin who manages it).
--   * STUDENTS. student_cover() returns, for the classes a student is enrolled in, who is covering, who for, and
--     the lesson topic. A Smart Learning lesson is only offered as openable when the student can already open it
--     (it has been assigned to their class); cover does not assign lessons by itself.
--   * EMAIL BOOKKEEPING. Columns that remember who has already been emailed about each class, so each person is
--     told once and a swap tells the right people. The emails themselves are sent by the app (see
--     /api/substitution/notify-cover and /api/cron/substitution-reminders).
--
-- Nothing is deleted. Five new nullable columns. Run after 074. Roll back with
-- scripts/migrations/rollback/075_substitution_notifications_and_student_view_rollback.sql

begin;

alter table public.substitution_assignments
  add column if not exists substitute_notified_id uuid,
  add column if not exists substitute_notified_at timestamptz,
  add column if not exists absent_told_id uuid,
  add column if not exists absent_told_at timestamptz,
  add column if not exists reminded_at timestamptz;

-- ---- internal helpers (not callable by clients) -------------------------------------------------------------

-- Put one message in a direct conversation between two staff members, starting the conversation if there is none.
create or replace function public.substitution_send_message(p_from uuid, p_to uuid, p_body text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_conv uuid;
begin
  if p_from is null or p_to is null or p_from = p_to or coalesce(p_body, '') = '' then return; end if;
  if (
    select count(*) from profiles
    where id in (p_from, p_to) and role in ('teacher', 'supervisor', 'admin', 'principal') and coalesce(is_active, true)
  ) < 2 then
    return;
  end if;

  select cp1.conversation_id into v_conv
  from conversation_participants cp1
  join conversation_participants cp2 on cp2.conversation_id = cp1.conversation_id
  join conversations c on c.id = cp1.conversation_id
  where c.type = 'direct' and cp1.user_id = p_from and cp2.user_id = p_to
  limit 1;

  if v_conv is null then
    insert into conversations (type) values ('direct') returning id into v_conv;
    insert into conversation_participants (conversation_id, user_id) values (v_conv, p_from), (v_conv, p_to);
  end if;

  insert into messages (conversation_id, sender_id, body) values (v_conv, p_from, left(p_body, 4000));
end;
$$;

-- The classes behind a set of assignments, worded for a message, in date and period order.
create or replace function public.substitution_notice_rows(p_ids uuid[])
returns table (rn bigint, what text, absent_id uuid, absent_name text, lesson text, sid uuid, sub_name text, status text)
language sql security definer
set search_path = public, pg_temp
as $$
  select row_number() over (order by sa.class_date, p.order_index, s.subject),
         to_char(sa.class_date, 'Dy FMDD Mon') || ' · ' || p.name || ' · ' || s.subject || coalesce(' · ' || cg.name, ''),
         a.teacher_id, tp.full_name,
         coalesce(lp.topic || ' (lesson plan)', ll.title || ' (Smart Learning)'),
         sa.substitute_teacher_id, sub.full_name, sa.status
  from substitution_assignments sa
  join timetable_sections s on s.id = sa.section_id
  join timetable_periods p on p.id = s.period_id
  join teacher_absences a on a.id = sa.absence_id
  join profiles tp on tp.id = a.teacher_id
  left join profiles sub on sub.id = sa.substitute_teacher_id
  left join class_groups cg on cg.id = s.class_group_id
  left join lesson_plans lp on lp.id = sa.lesson_plan_id
  left join learning_lessons ll on ll.id = sa.learning_lesson_id
  where sa.id = any(p_ids);
$$;

-- Tell the people affected by a set of assignments that were just created or changed. p_actor is who arranged it
-- (and is the sender); p_released_sub is a substitute who has just been swapped out of a class.
create or replace function public.substitution_notify_inbox(p_ids uuid[], p_actor uuid, p_released_sub uuid default null)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_body text;
  v_total int;
begin
  -- each substitute: what they have been given
  for r in select distinct n.sid as who from public.substitution_notice_rows(p_ids) n where n.sid is not null and n.sid <> p_actor loop
    select count(*) into v_total from public.substitution_notice_rows(p_ids) n where n.sid = r.who;
    select 'Cover arranged for you.' || E'\n' || string_agg(q.what || '. Covering for ' || q.absent_name || coalesce('. Lesson: ' || q.lesson, '') || '.', E'\n' order by q.rn)
      into v_body
      from (select * from public.substitution_notice_rows(p_ids) n where n.sid = r.who order by n.rn limit 25) q;
    if v_total > 25 then v_body := v_body || E'\n' || 'and ' || (v_total - 25) || ' more.'; end if;
    perform public.substitution_send_message(p_actor, r.who, v_body || E'\n\n' || 'Open My Cover in the Smart Learning menu to read the lessons.');
  end loop;

  -- a substitute who has just been swapped out
  if p_released_sub is not null and p_released_sub <> p_actor then
    select 'You are no longer covering:' || E'\n' || string_agg(n.what, E'\n' order by n.rn)
      into v_body from public.substitution_notice_rows(p_ids) n;
    perform public.substitution_send_message(p_actor, p_released_sub, v_body);
  end if;

  -- the absent teacher, when somebody else arranged their cover
  for r in select distinct n.absent_id as who from public.substitution_notice_rows(p_ids) n where n.absent_id <> p_actor loop
    select count(*) into v_total from public.substitution_notice_rows(p_ids) n where n.absent_id = r.who;
    select 'Cover for your classes:' || E'\n' || string_agg(q.what || ': ' || case when q.status = 'assigned' then 'covered by ' || q.sub_name else 'no substitute yet' end, E'\n' order by q.rn)
      into v_body
      from (select * from public.substitution_notice_rows(p_ids) n where n.absent_id = r.who order by n.rn limit 25) q;
    if v_total > 25 then v_body := v_body || E'\n' || 'and ' || (v_total - 25) || ' more.'; end if;
    perform public.substitution_send_message(p_actor, r.who, v_body);
  end loop;
end;
$$;

-- ---- the engine and the swap, now telling people ---------------------------------------------------------------

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

  perform public.substitution_notify_inbox(array[p_assignment_id], auth.uid(), v.current_sub);

  return jsonb_build_object('status', 'assigned', 'substitute_id', v_new, 'substitute_name', v_name);
end;
$$;

-- ---- My Cover ---------------------------------------------------------------------------------------------------

-- The classes the caller is covering in a date range.
create or replace function public.my_cover(p_from date, p_to date)
returns table (
  assignment_id uuid, class_date date, period_name text, period_order int, start_time time, subject text,
  class_name text, room text, absent_name text, lesson_label text
)
language sql security definer
set search_path = public, pg_temp
as $$
  select sa.id, sa.class_date, p.name, p.order_index, p.start_time, s.subject, cg.name, s.room, tp.full_name,
         coalesce(lp.topic || ' (lesson plan)', ll.title || ' (Smart Learning)')
  from substitution_assignments sa
  join timetable_sections s on s.id = sa.section_id
  join timetable_periods p on p.id = s.period_id
  join teacher_absences a on a.id = sa.absence_id
  join profiles tp on tp.id = a.teacher_id
  left join class_groups cg on cg.id = s.class_group_id
  left join lesson_plans lp on lp.id = sa.lesson_plan_id
  left join learning_lessons ll on ll.id = sa.learning_lesson_id
  where sa.substitute_teacher_id = auth.uid()
    and sa.status = 'assigned'
    and sa.class_date between p_from and p_to
  order by sa.class_date, p.order_index;
$$;

-- How many classes the caller is covering from today on (the menu badge).
create or replace function public.my_cover_count()
returns integer
language sql security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from substitution_assignments sa
  where sa.substitute_teacher_id = auth.uid() and sa.status = 'assigned' and sa.class_date >= public.school_today();
$$;

-- The lesson attached to a class, for the person covering it. Also readable by the absent teacher and by an HOD or
-- admin who manages the class.
create or replace function public.cover_lesson(p_assignment_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  select sa.lesson_plan_id, sa.learning_lesson_id, sa.substitute_teacher_id as sub_id, a.teacher_id as absent_id into v
  from substitution_assignments sa
  join teacher_absences a on a.id = sa.absence_id
  where sa.id = p_assignment_id;
  if not found then raise exception 'That class was not found.' using errcode = 'P0001'; end if;
  if not (v.sub_id = auth.uid() or v.absent_id = auth.uid() or public.substitution_can_manage(p_assignment_id)) then
    raise exception 'You cannot open this lesson.' using errcode = '42501';
  end if;

  if v.lesson_plan_id is not null then
    return (
      select jsonb_build_object(
        'kind', 'lesson_plan', 'subject', lp.subject, 'grade', lp.grade, 'term', lp.term, 'unit_theme', lp.unit_theme,
        'focus_strand', lp.focus_strand, 'topic', lp.topic, 'focus_question', lp.focus_question, 'duration', lp.duration,
        'attainment_target', lp.attainment_target, 'specific_objective', lp.specific_objective, 'skills', lp.skills,
        'prior_learning', lp.prior_learning, 'materials', lp.materials, 'engage', lp.engage, 'explore', lp.explore,
        'explain', lp.explain, 'elaborate', lp.elaborate, 'evaluate', lp.evaluate, 'success_criteria', lp.success_criteria
      )
      from lesson_plans lp where lp.id = v.lesson_plan_id
    );
  end if;
  if v.learning_lesson_id is not null then
    return (
      select jsonb_build_object(
        'kind', 'learning_lesson', 'title', ll.title, 'subject', ll.subject, 'grade', ll.grade, 'key_terms', ll.key_terms,
        'steps', (select jsonb_agg(jsonb_build_object('key', s ->> 'key', 'text', s ->> 'text', 'resources', s -> 'resources') order by ord)
                    from jsonb_array_elements(ll.steps) with ordinality as x(s, ord))
      )
      from learning_lessons ll where ll.id = v.learning_lesson_id
    );
  end if;
  return null;
end;
$$;

-- ---- students ---------------------------------------------------------------------------------------------------

-- Cover for the classes the caller is enrolled in. lesson_id is set only when the student can already open that
-- Smart Learning lesson.
create or replace function public.student_cover(p_from date, p_to date)
returns table (class_date date, section_id uuid, substitute_name text, absent_name text, lesson_label text, lesson_id uuid)
language sql security definer
set search_path = public, pg_temp
as $$
  select sa.class_date, sa.section_id, sub.full_name, tp.full_name, coalesce(lp.topic, ll.title),
         case when sa.learning_lesson_id is not null and public.learning_student_access(sa.learning_lesson_id) = 'open'
              then sa.learning_lesson_id end
  from substitution_assignments sa
  join teacher_absences a on a.id = sa.absence_id
  join profiles tp on tp.id = a.teacher_id
  join profiles sub on sub.id = sa.substitute_teacher_id
  left join lesson_plans lp on lp.id = sa.lesson_plan_id
  left join learning_lessons ll on ll.id = sa.learning_lesson_id
  where sa.status = 'assigned'
    and sa.class_date between p_from and p_to
    and sa.section_id in (select public.my_section_ids());
$$;

-- ---- who may call what ----------------------------------------------------------------------------------------

revoke execute on function
  public.substitution_send_message(uuid, uuid, text),
  public.substitution_notice_rows(uuid[]),
  public.substitution_notify_inbox(uuid[], uuid, uuid)
from public, anon, authenticated;

revoke execute on function
  public.my_cover(date, date), public.my_cover_count(), public.cover_lesson(uuid), public.student_cover(date, date)
from public, anon;

grant execute on function
  public.my_cover(date, date), public.my_cover_count(), public.cover_lesson(uuid), public.student_cover(date, date)
to authenticated;

commit;
