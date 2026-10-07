-- 088: the school day (Smart Assess school tools).
--
-- WHAT: three additions to the timetable, all backward compatible.
--   1. school_day_blocks: lunch windows by grade, and school events (devotion, clubs and societies, sports day...) that take time
--      out of lessons. Weekly ("Mondays 8 to 9") or one-off ("Fri 12 Nov, all day"), for every grade or chosen grades.
--      Nothing is pre-filled here: each school (or its seed file) adds its own.
--   2. timetable_sections.span: how many periods in a row a class lasts (1 = a normal period, 2 = a double period). Existing rows are 1.
--      A trigger stops a teacher or a class being booked twice in any hour of a longer lesson.
--   3. Who may change the bell times: only the school admin and the principal / vice principals (role 'principal'). Heads of
--      department used to be able to (migration 030) and now only read them. They still place classes for their own department.
--
-- Events and lunch are an overlay: they never delete or block existing sections in the database (an event added later must not
-- break a timetable already built). The screens show the clash instead.
-- Roll back with scripts/migrations/rollback/088_school_day_rollback.sql

begin;

-- ---------- 1. lunch and events ----------
create table public.school_day_blocks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('lunch', 'event')),
  title text not null check (btrim(title) <> '' and length(title) <= 120),
  grades int[],                                   -- null = every grade
  days smallint[],                                -- weekly pattern: 1 = Monday ... 5 = Friday. Null for a one-off event.
  date_from date,                                 -- one-off event, first day (inclusive)
  date_to date,                                   -- one-off event, last day (inclusive)
  start_time time,                                -- null with end_time null = the whole school day
  end_time time,
  academic_year text not null,
  note text check (note is null or length(note) <= 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_day_blocks_when check (
    (days is not null and date_from is null and date_to is null)
    or (days is null and date_from is not null and date_to is not null and date_to >= date_from)),
  constraint school_day_blocks_days check (days is null or (cardinality(days) between 1 and 5 and days <@ array[1, 2, 3, 4, 5]::smallint[])),
  constraint school_day_blocks_times check ((start_time is null) = (end_time is null) and (start_time is null or end_time > start_time)),
  constraint school_day_blocks_grades check (grades is null or (cardinality(grades) between 1 and 7 and grades <@ array[7, 8, 9, 10, 11, 12, 13])),
  constraint school_day_blocks_lunch_shape check (kind <> 'lunch' or (days is not null and start_time is not null and grades is not null))
);
create index school_day_blocks_year on public.school_day_blocks (academic_year);

alter table public.school_day_blocks enable row level security;
revoke all on public.school_day_blocks from anon, public;
grant select, insert, update, delete on public.school_day_blocks to authenticated;

create policy "Everyone signed in sees the school day" on public.school_day_blocks for select using (auth.uid() is not null);
create policy "Admin and principals manage the school day" on public.school_day_blocks
  for all using (public.is_admin() or public.is_principal()) with check (public.is_admin() or public.is_principal());

create or replace function public.trg_school_day_blocks_touch()
returns trigger language plpgsql set search_path = public, pg_temp
as $$ begin new.updated_at := now(); if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if; return new; end $$;
create trigger school_day_blocks_touch before insert or update on public.school_day_blocks
  for each row execute function public.trg_school_day_blocks_touch();

-- ---------- 2. classes that last more than one period ----------
alter table public.timetable_sections add column if not exists span smallint not null default 1;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'timetable_sections_span_check') then
    alter table public.timetable_sections add constraint timetable_sections_span_check check (span between 1 and 4);
  end if;
end $$;

-- The periods a lesson covers: its own, and the next (span - 1) in the school's order.
create or replace function public.section_period_ids(p_period uuid, p_span int)
returns uuid[]
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(p.id order by p.order_index), '{}'::uuid[])
  from timetable_periods p, timetable_periods first
  where first.id = p_period and p.academic_year = first.academic_year
    and p.order_index >= first.order_index and p.order_index < first.order_index + greatest(p_span, 1)
$$;

create or replace function public.trg_timetable_sections_span()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
declare
  v_mine uuid[];
begin
  v_mine := public.section_period_ids(new.period_id, new.span);
  if coalesce(cardinality(v_mine), 0) < new.span then
    raise exception 'There are not enough periods after this one for a lesson of % periods.', new.span using errcode = '23514';
  end if;
  if exists (
    select 1 from timetable_sections o
    where o.id is distinct from new.id and o.academic_year = new.academic_year and o.day_of_week = new.day_of_week
      and (o.teacher_id = new.teacher_id or (new.class_group_id is not null and o.class_group_id = new.class_group_id))
      and public.section_period_ids(o.period_id, o.span) && v_mine
  ) then
    raise exception 'That teacher or class is already scheduled in part of this time.' using errcode = '23505';
  end if;
  return new;
end $$;
create trigger timetable_sections_span before insert or update on public.timetable_sections
  for each row execute function public.trg_timetable_sections_span();

-- ---------- 3. who may change the bell times ----------
drop policy if exists "Supervisors manage timetable periods" on public.timetable_periods;
create policy "Principals manage timetable periods" on public.timetable_periods
  for all using (public.is_principal()) with check (public.is_principal());
-- ("Admins manage all timetable periods" and "Authenticated users view timetable periods" from 029 stay as they are.)

commit;

select 'Migration 088 applied' as result;
