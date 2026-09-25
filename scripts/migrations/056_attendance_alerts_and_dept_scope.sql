-- Attendance alerts, and department-scoped attendance for HODs.
-- Requires 055. Additive except that four report functions are replaced by
-- versions that also serve HODs (limited to their own department's classes).
--
-- ALERTS (seen by principals and school admins only)
--   teacher_late         a teacher started class more than 10 minutes after the bell
--   teacher_not_started  10 minutes into a period and nobody has started the class
--                        (cleared automatically if the teacher starts it later)
--   truancy              a student registered present this morning was marked absent
--                        from a class (cleared if the mark is corrected)
--   Late and truancy alerts are created the instant the data is recorded (database
--   triggers). "Not started" is a time-based check, run by refresh_attendance_alerts(),
--   which any signed-in staff member's page can call; it does nothing on a day when
--   no class has been started and no register taken (so holidays stay quiet), and it
--   only looks at classes that are in progress right now.
--
-- Roll back with scripts/migrations/rollback/056_attendance_alerts_and_dept_scope_rollback.sql

begin;

-- ---- alerts -------------------------------------------------------------------

create table public.attendance_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('teacher_late', 'teacher_not_started', 'truancy')),
  class_date date not null,
  section_id uuid references public.timetable_sections(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  emailed_at timestamptz
);
-- One alert per event: same kind, class, day and student.
create unique index attendance_alerts_once
  on public.attendance_alerts (kind, section_id, class_date, coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index attendance_alerts_recent_idx on public.attendance_alerts (created_at desc);

create table public.attendance_alert_reads (
  alert_id uuid not null references public.attendance_alerts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);

alter table public.attendance_alerts enable row level security;
alter table public.attendance_alert_reads enable row level security;

create policy "Principals and admins view attendance alerts" on public.attendance_alerts
  for select using (public.is_principal() or public.is_admin());
create policy "People view their own alert read marks" on public.attendance_alert_reads
  for select using (user_id = auth.uid());
-- No direct writes: alerts are created by the triggers/functions below and
-- read marks by mark_alerts_read().

-- ---- alert triggers -------------------------------------------------------------

create or replace function public.trg_class_session_alerts()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  grace interval := make_interval(mins => public.attendance_late_minutes());
  late_min int;
begin
  select ts.teacher_id, ts.subject, t.full_name as tname, cg.name as cname, p.name as pname,
         public.period_start(new.class_date, p.start_time) as sts
    into s
    from timetable_sections ts
    join timetable_periods p on p.id = ts.period_id
    join profiles t on t.id = ts.teacher_id
    left join class_groups cg on cg.id = ts.class_group_id
   where ts.id = new.section_id;
  if not found then return new; end if;

  -- The class has started: any earlier "not started" alert no longer applies.
  update attendance_alerts set resolved_at = now()
   where kind = 'teacher_not_started' and section_id = new.section_id and class_date = new.class_date and resolved_at is null;

  if new.started_at > s.sts + grace then
    late_min := floor(extract(epoch from (new.started_at - s.sts)) / 60)::int;
    insert into attendance_alerts (kind, class_date, section_id, teacher_id, message)
    values ('teacher_late', new.class_date, new.section_id, s.teacher_id,
            format('%s started %s%s %s minutes late (%s)', s.tname, s.subject, coalesce(' · ' || s.cname, ''), late_min, s.pname))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger class_sessions_alerts after insert on public.class_sessions
  for each row execute function public.trg_class_session_alerts();

-- A student who was registered present but is marked absent from a class.
create or replace function public.raise_truancy_alert(p_section_id uuid, p_date date, p_student uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare s record;
begin
  select ts.teacher_id, ts.subject, cg.name as cname, p.name as pname, st.full_name as sname
    into s
    from timetable_sections ts
    join timetable_periods p on p.id = ts.period_id
    join profiles st on st.id = p_student
    left join class_groups cg on cg.id = ts.class_group_id
   where ts.id = p_section_id;
  if not found then return; end if;
  insert into attendance_alerts (kind, class_date, section_id, teacher_id, student_id, message)
  values ('truancy', p_date, p_section_id, s.teacher_id, p_student,
          format('%s was at school but absent from %s%s (%s)', s.sname, s.subject, coalesce(' · ' || s.cname, ''), s.pname))
  on conflict do nothing;
end;
$$;

create or replace function public.trg_class_attendance_alerts()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'absent' then
    if exists (select 1 from daily_attendance da where da.student_id = new.student_id and da.att_date = new.class_date and da.status = 'present') then
      perform public.raise_truancy_alert(new.section_id, new.class_date, new.student_id);
    end if;
  else
    -- Marked present/late after all: the alert no longer applies.
    update attendance_alerts set resolved_at = now()
     where kind = 'truancy' and section_id = new.section_id and class_date = new.class_date and student_id = new.student_id and resolved_at is null;
  end if;
  return new;
end;
$$;

create trigger class_attendance_alerts after insert or update of status on public.class_attendance
  for each row execute function public.trg_class_attendance_alerts();

-- The register can be taken after the roll calls: catch that order too.
create or replace function public.trg_daily_attendance_alerts()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare r record;
begin
  if new.status = 'present' then
    for r in select ca.section_id from class_attendance ca where ca.student_id = new.student_id and ca.class_date = new.att_date and ca.status = 'absent' loop
      perform public.raise_truancy_alert(r.section_id, new.att_date, new.student_id);
    end loop;
  else
    -- Registered late/absent after all: nothing to call truancy.
    update attendance_alerts set resolved_at = now()
     where kind = 'truancy' and student_id = new.student_id and class_date = new.att_date and resolved_at is null;
  end if;
  return new;
end;
$$;

create trigger daily_attendance_alerts after insert or update of status on public.daily_attendance
  for each row execute function public.trg_daily_attendance_alerts();

-- ---- time-based check + read state ------------------------------------------------

create or replace function public.refresh_attendance_alerts()
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := public.school_today();
  grace interval := make_interval(mins => public.attendance_late_minutes());
  r record;
  n integer := 0;
  v_rows integer;
begin
  if not public.is_staff() then raise exception 'Not allowed.' using errcode = '42501'; end if;

  -- Only on days the school is actually running.
  if not (exists (select 1 from class_sessions where class_date = v_today)
          or exists (select 1 from daily_attendance where att_date = v_today)) then
    return 0;
  end if;

  for r in
    select ts.id as sid, ts.teacher_id as tid, ts.subject, t.full_name as tname, cg.name as cname, p.name as pname
      from timetable_sections ts
      join timetable_periods p on p.id = ts.period_id
      join profiles t on t.id = ts.teacher_id
      left join class_groups cg on cg.id = ts.class_group_id
     where ts.day_of_week = extract(isodow from v_today)::int
       and ts.academic_year = public.school_year_for(v_today)
       and now() > public.period_start(v_today, p.start_time) + grace
       and now() <= public.period_start(v_today, p.end_time)
       and not exists (select 1 from class_sessions cs where cs.section_id = ts.id and cs.class_date = v_today)
  loop
    insert into attendance_alerts (kind, class_date, section_id, teacher_id, message)
    values ('teacher_not_started', v_today, r.sid, r.tid,
            format('%s has not started %s%s (%s), %s minutes after the bell', r.tname, r.subject, coalesce(' · ' || r.cname, ''), r.pname, public.attendance_late_minutes()))
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    n := n + v_rows;
  end loop;
  return n;
end;
$$;

-- How many active alerts the caller has not read yet (0 for anyone who cannot see alerts).
create or replace function public.my_unread_alert_count()
returns integer
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case when public.is_principal() or public.is_admin() then
    (select count(*)::int from attendance_alerts a
      where a.resolved_at is null
        and not exists (select 1 from attendance_alert_reads r where r.alert_id = a.id and r.user_id = auth.uid()))
  else 0 end
$$;

-- Mark alerts read for the caller (all active alerts when no list is given).
create or replace function public.mark_alerts_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  perform public.require_oversight();
  insert into attendance_alert_reads (alert_id, user_id)
  select a.id, auth.uid() from attendance_alerts a
   where (p_ids is null or a.id = any (p_ids))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---- reports now also serve HODs, limited to their own department --------------------

create or replace function public.attendance_board(p_date date)
returns table (
  section_id uuid, subject text, room text, class_name text, teacher_id uuid, teacher_name text,
  department_name text, period_name text, period_order int, starts_at timestamptz, ends_at timestamptz,
  started_at timestamptz, teacher_status text, minutes_late int, roll_taken boolean,
  enrolled int, present int, late int, absent int, truant int
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  grace interval := make_interval(mins => public.attendance_late_minutes());
  v_all boolean := public.is_principal() or public.is_admin();
  v_dept uuid := public.my_supervised_department();
begin
  if not v_all and v_dept is null then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select
    s.id, s.subject, s.room, cg.name, s.teacher_id, t.full_name, d.name, p.name, p.order_index,
    public.period_start(p_date, p.start_time), public.period_start(p_date, p.end_time),
    cs.started_at,
    case
      when cs.id is not null then
        case when cs.started_at <= public.period_start(p_date, p.start_time) + grace then 'on_time' else 'late' end
      when p_date > public.school_today() then 'upcoming'
      when p_date < public.school_today() then 'missed'
      when now() < public.period_start(p_date, p.start_time) then 'upcoming'
      when now() <= public.period_start(p_date, p.start_time) + grace then 'due'
      when now() <= public.period_start(p_date, p.end_time) then 'not_started'
      else 'missed'
    end,
    case when cs.id is not null and cs.started_at > public.period_start(p_date, p.start_time)
         then floor(extract(epoch from (cs.started_at - public.period_start(p_date, p.start_time))) / 60)::int end,
    (cs.roll_taken_at is not null),
    (select count(*)::int from section_enrollments se where se.section_id = s.id),
    (select count(*)::int from class_attendance ca where ca.section_id = s.id and ca.class_date = p_date and ca.status = 'present'),
    (select count(*)::int from class_attendance ca where ca.section_id = s.id and ca.class_date = p_date and ca.status = 'late'),
    (select count(*)::int from class_attendance ca where ca.section_id = s.id and ca.class_date = p_date and ca.status = 'absent'),
    (select count(*)::int from class_attendance ca
       join daily_attendance da on da.student_id = ca.student_id and da.att_date = ca.class_date and da.status = 'present'
      where ca.section_id = s.id and ca.class_date = p_date and ca.status = 'absent')
  from timetable_sections s
  join timetable_periods p on p.id = s.period_id
  join profiles t on t.id = s.teacher_id
  left join class_groups cg on cg.id = s.class_group_id
  left join departments d on d.id = s.department_id
  left join class_sessions cs on cs.section_id = s.id and cs.class_date = p_date
  where s.day_of_week = extract(isodow from p_date)::int
    and s.academic_year = public.school_year_for(p_date)
    and (v_all or s.department_id = v_dept)
  order by p.order_index, t.full_name;
end;
$$;

create or replace function public.section_attendance(p_section_id uuid, p_date date)
returns table (student_id uuid, student_name text, student_code text, class_status text, morning_status text, is_truant boolean)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_all boolean := public.is_principal() or public.is_admin();
  v_dept uuid := public.my_supervised_department();
begin
  if not v_all then
    if v_dept is null or not exists (select 1 from timetable_sections x where x.id = p_section_id and x.department_id = v_dept) then
      raise exception 'Not allowed.' using errcode = '42501';
    end if;
  end if;
  return query
  select st.id, st.full_name, st.student_id, ca.status, da.status,
         (ca.status = 'absent' and da.status = 'present')
  from section_enrollments se
  join profiles st on st.id = se.student_id
  left join class_attendance ca on ca.section_id = se.section_id and ca.class_date = p_date and ca.student_id = se.student_id
  left join daily_attendance da on da.student_id = se.student_id and da.att_date = p_date
  where se.section_id = p_section_id
  order by st.full_name;
end;
$$;

create or replace function public.truancy_report(p_from date, p_to date)
returns table (
  class_date date, student_id uuid, student_name text, student_code text, home_class text,
  section_id uuid, subject text, period_name text, starts_at timestamptz, teacher_name text, room text
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_all boolean := public.is_principal() or public.is_admin();
  v_dept uuid := public.my_supervised_department();
begin
  if not v_all and v_dept is null then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select ca.class_date, st.id, st.full_name, st.student_id,
         (select string_agg(cg2.name, ', ') from enrollments e join class_groups cg2 on cg2.id = e.class_group_id where e.student_id = st.id),
         s.id, s.subject, p.name, public.period_start(ca.class_date, p.start_time), t.full_name, s.room
  from class_attendance ca
  join daily_attendance da on da.student_id = ca.student_id and da.att_date = ca.class_date and da.status = 'present'
  join profiles st on st.id = ca.student_id
  join timetable_sections s on s.id = ca.section_id
  join timetable_periods p on p.id = s.period_id
  join profiles t on t.id = s.teacher_id
  where ca.status = 'absent' and ca.class_date between p_from and p_to
    and (v_all or s.department_id = v_dept)
  order by ca.class_date desc, p.order_index, st.full_name;
end;
$$;

create or replace function public.teacher_punctuality(p_from date, p_to date)
returns table (
  teacher_id uuid, teacher_name text, department_name text,
  scheduled int, on_time int, late int, missed int, avg_minutes_late numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  grace interval := make_interval(mins => public.attendance_late_minutes());
  v_all boolean := public.is_principal() or public.is_admin();
  v_dept uuid := public.my_supervised_department();
begin
  if not v_all and v_dept is null then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  with days as (
    select cs0.class_date as d from class_sessions cs0 where cs0.class_date between p_from and p_to
    union
    select da0.att_date from daily_attendance da0 where da0.att_date between p_from and p_to
  ),
  sched as (
    select s.id as sid, s.teacher_id as tid, s.department_id as did, days.d as d, public.period_start(days.d, p.start_time) as sts
    from days
    join timetable_sections s on s.day_of_week = extract(isodow from days.d)::int and s.academic_year = public.school_year_for(days.d)
    join timetable_periods p on p.id = s.period_id
    where public.period_start(days.d, p.start_time) + grace < now()
      and (v_all or s.department_id = v_dept)
  )
  select t.id, t.full_name, dep.name,
         count(*)::int,
         (count(*) filter (where cs.id is not null and cs.started_at <= sched.sts + grace))::int,
         (count(*) filter (where cs.id is not null and cs.started_at > sched.sts + grace))::int,
         (count(*) filter (where cs.id is null))::int,
         round((avg(extract(epoch from (cs.started_at - sched.sts)) / 60) filter (where cs.id is not null and cs.started_at > sched.sts + grace))::numeric, 1)
  from sched
  join profiles t on t.id = sched.tid
  left join departments dep on dep.id = sched.did
  left join class_sessions cs on cs.section_id = sched.sid and cs.class_date = sched.d
  group by t.id, t.full_name, dep.name
  order by t.full_name;
end;
$$;

revoke execute on function
  public.refresh_attendance_alerts(), public.my_unread_alert_count(), public.mark_alerts_read(uuid[]),
  public.raise_truancy_alert(uuid, date, uuid)
from public, anon;
grant execute on function public.refresh_attendance_alerts(), public.my_unread_alert_count(), public.mark_alerts_read(uuid[]) to authenticated;
-- raise_truancy_alert is only ever called by the triggers.
revoke execute on function public.raise_truancy_alert(uuid, date, uuid) from authenticated;

commit;
