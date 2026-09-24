-- Principal / Vice Principal role, and class attendance (teacher arrival,
-- morning register, period roll calls, truancy).
--
-- Additive: one new allowed role value, three new tables, new functions and
-- new read policies. Nothing existing is changed except that is_staff() and
-- list_staff_directory() now also count principals (so they can use staff
-- messaging) and the profiles.role check allows 'principal'.
--
-- HOW ATTENDANCE WORKS
--   * Morning register: a teacher assigned to a class marks each student
--     present / late / absent for the day  -> daily_attendance
--   * Teacher arrival: the teacher taps "Start class" for a timetable period
--     -> class_sessions.started_at (recorded by the DATABASE clock, not the
--     browser). Late = more than 10 minutes after the period starts.
--   * Roll call: the teacher marks each student in the period -> class_attendance
--   * Truancy: a student marked PRESENT at the morning register but marked
--     ABSENT from a class. (Students marked "late" in the morning are left out:
--     the register does not record when they arrived, so an earlier missed
--     class would be a false accusation.)
--   All writes go through the functions below, which check who is calling, that
--   the class is scheduled today, and that the students belong to it. Clients
--   have no direct INSERT/UPDATE/DELETE on the attendance tables.
--   All dates and times are Jamaica time (America/Jamaica, no daylight saving).
--
-- Roll back with scripts/migrations/rollback/055_principal_role_and_attendance_rollback.sql

begin;

-- ---- 1. the principal role -------------------------------------------------

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['student'::text, 'teacher'::text, 'supervisor'::text, 'admin'::text, 'principal'::text]));

alter table public.profiles add column if not exists leadership_title text
  check (leadership_title in ('Principal', 'Vice Principal'));

-- Principals can ask for a password reset like everyone else.
alter table public.password_reset_requests drop constraint password_reset_requests_user_type_check;
alter table public.password_reset_requests add constraint password_reset_requests_user_type_check
  check (user_type = any (array['student'::text, 'teacher'::text, 'supervisor'::text, 'principal'::text]));

create or replace function public.is_principal()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'principal')
$$;

-- Principals are staff: they can use staff messaging like everyone else.
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('teacher', 'supervisor', 'admin', 'principal')
  );
$$;

create or replace function public.list_staff_directory()
returns table(id uuid, full_name text, role text)
language sql security definer
set search_path to 'public'
as $$
  select p.id, p.full_name, p.role
  from profiles p
  where p.role in ('teacher', 'supervisor', 'admin', 'principal')
  and coalesce(p.is_active, true) = true
  and public.is_staff()
  order by p.full_name;
$$;

-- ---- 2. small helpers (Jamaica time) ------------------------------------------

create or replace function public.school_today()
returns date language sql stable
as $$ select (now() at time zone 'America/Jamaica')::date $$;

-- Same rule the app uses: the academic year starts in August.
create or replace function public.school_year_for(d date)
returns text language sql immutable
as $$
  select case when extract(month from d) >= 8
              then extract(year from d)::int || '-' || (extract(year from d)::int + 1)
              else (extract(year from d)::int - 1) || '-' || extract(year from d)::int end
$$;

-- A local date + clock time -> the exact moment (timestamptz).
create or replace function public.period_start(d date, t time)
returns timestamptz language sql immutable
as $$ select (d + t) at time zone 'America/Jamaica' $$;

-- How many minutes after a period starts a teacher counts as late.
create or replace function public.attendance_late_minutes()
returns int language sql immutable
as $$ select 10 $$;

create or replace function public.is_hod_of_section(p_section_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from timetable_sections s
    where s.id = p_section_id and s.department_id is not null and s.department_id = my_supervised_department()
  )
$$;

-- ---- 3. tables ---------------------------------------------------------------

create table public.daily_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  att_date date not null,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_by uuid references public.profiles(id) on delete set null,
  marked_at timestamptz not null default now(),
  unique (student_id, att_date)
);
create index daily_attendance_date_idx on public.daily_attendance (att_date);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.timetable_sections(id) on delete cascade,
  class_date date not null,
  started_at timestamptz not null default now(),
  started_by uuid references public.profiles(id) on delete set null,
  roll_taken_at timestamptz,
  unique (section_id, class_date)
);
create index class_sessions_date_idx on public.class_sessions (class_date);

create table public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.timetable_sections(id) on delete cascade,
  class_date date not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_by uuid references public.profiles(id) on delete set null,
  marked_at timestamptz not null default now(),
  unique (section_id, class_date, student_id)
);
create index class_attendance_date_idx on public.class_attendance (class_date);
create index class_attendance_student_idx on public.class_attendance (student_id, class_date);

alter table public.daily_attendance enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_attendance enable row level security;

-- Read access only. There are deliberately no INSERT/UPDATE/DELETE policies:
-- every write goes through start_class / mark_class_attendance /
-- mark_morning_register below.
-- A teacher sees the morning register of students they teach, whether through a
-- class group they are assigned to or through a timetable class (grades 10-11
-- are subject-based, so their students may not share a class group).
create policy "Teachers view daily attendance of their students" on public.daily_attendance
  for select using (public.is_teacher_of_class_student(student_id) or public.is_teacher_of_timetable_student(student_id));
create policy "Principals and admins view all daily attendance" on public.daily_attendance
  for select using (public.is_principal() or public.is_admin());
create policy "Students view own daily attendance" on public.daily_attendance
  for select using (student_id = auth.uid());

create policy "Teachers view sessions of their sections" on public.class_sessions
  for select using (public.is_teacher_of_section(section_id));
create policy "HODs view sessions of their department" on public.class_sessions
  for select using (public.is_hod_of_section(section_id));
create policy "Principals and admins view all class sessions" on public.class_sessions
  for select using (public.is_principal() or public.is_admin());

create policy "Teachers view attendance of their sections" on public.class_attendance
  for select using (public.is_teacher_of_section(section_id));
create policy "HODs view attendance of their department" on public.class_attendance
  for select using (public.is_hod_of_section(section_id));
create policy "Principals and admins view all class attendance" on public.class_attendance
  for select using (public.is_principal() or public.is_admin());
create policy "Students view own class attendance" on public.class_attendance
  for select using (student_id = auth.uid());

-- ---- 4. principals can READ the people and structure they oversee -------------

create policy "Principals view all profiles" on public.profiles
  for select using (public.is_principal());
create policy "Principals view all class groups" on public.class_groups
  for select using (public.is_principal());
create policy "Principals view all enrollments" on public.enrollments
  for select using (public.is_principal());
create policy "Principals view all teacher class assignments" on public.teacher_class_groups
  for select using (public.is_principal());
create policy "Principals view all teacher subjects" on public.teacher_subjects
  for select using (public.is_principal());
create policy "Principals view all timetable sections" on public.timetable_sections
  for select using (public.is_principal());
create policy "Principals view all section enrollments" on public.section_enrollments
  for select using (public.is_principal());

-- ---- 5. write functions (the only way attendance gets recorded) ---------------

-- Teacher taps "Start class". The moment is the database clock.
create or replace function public.start_class(p_section_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  per record;
  v_today date := public.school_today();
  v_start timestamptz;
  v_end timestamptz;
  cs public.class_sessions;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  select * into s from timetable_sections where id = p_section_id;
  if not found or s.teacher_id <> auth.uid() then
    raise exception 'This is not one of your classes.' using errcode = '42501';
  end if;
  if s.day_of_week <> extract(isodow from v_today)::int then
    raise exception 'This class is not scheduled today.' using errcode = 'P0001';
  end if;
  select * into per from timetable_periods where id = s.period_id;
  v_start := public.period_start(v_today, per.start_time);
  v_end := public.period_start(v_today, per.end_time);
  if now() < v_start - interval '15 minutes' then
    raise exception 'It is too early to start this class.' using errcode = 'P0001';
  end if;
  if now() > v_end then
    raise exception 'This period has already ended.' using errcode = 'P0001';
  end if;

  insert into class_sessions (section_id, class_date, started_by)
  values (p_section_id, v_today, auth.uid())
  on conflict (section_id, class_date) do nothing;

  select * into cs from class_sessions where section_id = p_section_id and class_date = v_today;
  return to_jsonb(cs);
end;
$$;

-- Roll call for one period. p_marks = [{"student_id": "...", "status": "present|absent|late"}, ...]
-- If the teacher never tapped "Start class", the first roll call starts it.
create or replace function public.mark_class_attendance(p_section_id uuid, p_marks jsonb)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  per record;
  v_today date := public.school_today();
  m jsonb;
  v_student uuid;
  v_status text;
  n integer := 0;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if jsonb_typeof(p_marks) is distinct from 'array' then raise exception 'Invalid roll call.' using errcode = 'P0001'; end if;
  select * into s from timetable_sections where id = p_section_id;
  if not found or s.teacher_id <> auth.uid() then
    raise exception 'This is not one of your classes.' using errcode = '42501';
  end if;
  if s.day_of_week <> extract(isodow from v_today)::int then
    raise exception 'This class is not scheduled today.' using errcode = 'P0001';
  end if;
  select * into per from timetable_periods where id = s.period_id;
  if now() < public.period_start(v_today, per.start_time) - interval '15 minutes' then
    raise exception 'It is too early to take the roll for this class.' using errcode = 'P0001';
  end if;

  insert into class_sessions (section_id, class_date, started_by)
  values (p_section_id, v_today, auth.uid())
  on conflict (section_id, class_date) do nothing;

  for m in select * from jsonb_array_elements(p_marks) loop
    v_student := (m ->> 'student_id')::uuid;
    v_status := m ->> 'status';
    if v_status is null or v_status not in ('present', 'absent', 'late') then
      raise exception 'Invalid attendance status.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from section_enrollments where section_id = p_section_id and student_id = v_student) then
      raise exception 'A student in this roll call is not in this class.' using errcode = 'P0001';
    end if;
    insert into class_attendance (section_id, class_date, student_id, status, marked_by)
    values (p_section_id, v_today, v_student, v_status, auth.uid())
    on conflict (section_id, class_date, student_id)
    do update set status = excluded.status, marked_by = excluded.marked_by, marked_at = now();
    n := n + 1;
  end loop;

  update class_sessions set roll_taken_at = now() where section_id = p_section_id and class_date = v_today;
  return n;
end;
$$;

-- Morning register for one class group, today. Teachers assigned to the class
-- group (or a school admin) may take it.
create or replace function public.mark_morning_register(p_class_group_id uuid, p_marks jsonb)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := public.school_today();
  m jsonb;
  v_student uuid;
  v_status text;
  n integer := 0;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if jsonb_typeof(p_marks) is distinct from 'array' then raise exception 'Invalid register.' using errcode = 'P0001'; end if;
  if not (
    exists (select 1 from teacher_class_groups where teacher_id = auth.uid() and class_group_id = p_class_group_id)
    or public.is_admin()
  ) then
    raise exception 'You are not assigned to this class.' using errcode = '42501';
  end if;

  for m in select * from jsonb_array_elements(p_marks) loop
    v_student := (m ->> 'student_id')::uuid;
    v_status := m ->> 'status';
    if v_status is null or v_status not in ('present', 'absent', 'late') then
      raise exception 'Invalid attendance status.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from enrollments where class_group_id = p_class_group_id and student_id = v_student) then
      raise exception 'A student in this register is not in this class.' using errcode = 'P0001';
    end if;
    insert into daily_attendance (student_id, att_date, status, marked_by)
    values (v_student, v_today, v_status, auth.uid())
    on conflict (student_id, att_date)
    do update set status = excluded.status, marked_by = excluded.marked_by, marked_at = now();
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---- 6. oversight reports (principal / school admin only) ----------------------

create or replace function public.require_oversight()
returns void
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_principal() or public.is_admin()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
end;
$$;

-- Every timetabled class on a day: who is teaching, whether they arrived,
-- and how the roll came out.
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

-- The roster of one class on one day.
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

-- Students at school (present at the morning register) but absent from a class.
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

-- How reliably each teacher reaches class. Only counts days on which the school
-- actually ran (some attendance was recorded), so weekends and holidays never
-- count against anyone, and only classes whose grace period has already passed.
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

-- One row per student: attendance over a date range.
create or replace function public.student_attendance_summary(p_from date, p_to date)
returns table (
  student_id uuid, student_name text, student_code text, class_name text,
  days_present int, days_late int, days_absent int, class_absences int, truancy_count int
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  perform public.require_oversight();
  return query
  select st.id, st.full_name, st.student_id,
         (select string_agg(cg.name, ', ') from enrollments e join class_groups cg on cg.id = e.class_group_id where e.student_id = st.id),
         (select count(*)::int from daily_attendance da where da.student_id = st.id and da.att_date between p_from and p_to and da.status = 'present'),
         (select count(*)::int from daily_attendance da where da.student_id = st.id and da.att_date between p_from and p_to and da.status = 'late'),
         (select count(*)::int from daily_attendance da where da.student_id = st.id and da.att_date between p_from and p_to and da.status = 'absent'),
         (select count(*)::int from class_attendance ca where ca.student_id = st.id and ca.class_date between p_from and p_to and ca.status = 'absent'),
         (select count(*)::int from class_attendance ca
            join daily_attendance da on da.student_id = ca.student_id and da.att_date = ca.class_date and da.status = 'present'
           where ca.student_id = st.id and ca.class_date between p_from and p_to and ca.status = 'absent')
  from profiles st
  where st.role = 'student' and coalesce(st.is_active, true)
  order by st.full_name;
end;
$$;

-- One student's day-by-day record.
create or replace function public.student_attendance_detail(p_student uuid, p_from date, p_to date)
returns table (
  att_date date, morning_status text, section_id uuid, subject text, period_name text,
  starts_at timestamptz, class_status text, is_truant boolean
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  perform public.require_oversight();
  return query
  select coalesce(ca.class_date, da.att_date), da.status, s.id, s.subject, p.name,
         case when ca.class_date is not null then public.period_start(ca.class_date, p.start_time) end,
         ca.status, (ca.status = 'absent' and da.status = 'present')
  from (select * from daily_attendance x where x.student_id = p_student and x.att_date between p_from and p_to) da
  full join (select * from class_attendance y where y.student_id = p_student and y.class_date between p_from and p_to) ca
    on ca.class_date = da.att_date
  left join timetable_sections s on s.id = ca.section_id
  left join timetable_periods p on p.id = s.period_id
  order by 1 desc, p.order_index;
end;
$$;

-- Only signed-in users may call any of these (each also checks the caller's role).
revoke execute on function
  public.start_class(uuid), public.mark_class_attendance(uuid, jsonb), public.mark_morning_register(uuid, jsonb),
  public.require_oversight(), public.attendance_board(date), public.section_attendance(uuid, date),
  public.truancy_report(date, date), public.teacher_punctuality(date, date),
  public.student_attendance_summary(date, date), public.student_attendance_detail(uuid, date, date)
from public, anon;
grant execute on function
  public.start_class(uuid), public.mark_class_attendance(uuid, jsonb), public.mark_morning_register(uuid, jsonb),
  public.require_oversight(), public.attendance_board(date), public.section_attendance(uuid, date),
  public.truancy_report(date, date), public.teacher_punctuality(date, date),
  public.student_attendance_summary(date, date), public.student_attendance_detail(uuid, date, date)
to authenticated;

commit;
