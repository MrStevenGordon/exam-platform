-- Rolls back 088. Lunch and event rows are deleted; every class goes back to one period (a double period keeps only its first hour).
begin;
drop trigger if exists timetable_sections_span on public.timetable_sections;
drop function if exists public.trg_timetable_sections_span();
drop function if exists public.section_period_ids(uuid, int);
alter table public.timetable_sections drop constraint if exists timetable_sections_span_check;
alter table public.timetable_sections drop column if exists span;
drop policy if exists "Principals manage timetable periods" on public.timetable_periods;
create policy "Supervisors manage timetable periods" on public.timetable_periods
  for all using (my_role() = 'supervisor' or is_admin()) with check (my_role() = 'supervisor' or is_admin());
drop table if exists public.school_day_blocks;
drop function if exists public.trg_school_day_blocks_touch();
commit;
select 'Migration 088 rolled back' as result;
