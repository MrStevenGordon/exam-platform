-- Removes attendance alerts and puts the four attendance report functions back
-- to their 055 versions (principals and school admins only, no HOD access).
-- Alert history is deleted.
begin;

drop trigger if exists daily_attendance_alerts on public.daily_attendance;
drop trigger if exists class_attendance_alerts on public.class_attendance;
drop trigger if exists class_sessions_alerts on public.class_sessions;
drop function if exists public.trg_daily_attendance_alerts();
drop function if exists public.trg_class_attendance_alerts();
drop function if exists public.trg_class_session_alerts();
drop function if exists public.raise_truancy_alert(uuid, date, uuid);
drop function if exists public.mark_alerts_read(uuid[]);
drop function if exists public.my_unread_alert_count();
drop function if exists public.refresh_attendance_alerts();
drop table if exists public.attendance_alert_reads;
drop table if exists public.attendance_alerts;

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
begin
  perform public.require_oversight();
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
  order by p.order_index, t.full_name;
end;
$$;

create or replace function public.section_attendance(p_section_id uuid, p_date date)
returns table (student_id uuid, student_name text, student_code text, class_status text, morning_status text, is_truant boolean)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  perform public.require_oversight();
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
begin
  perform public.require_oversight();
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
begin
  perform public.require_oversight();
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

commit;
