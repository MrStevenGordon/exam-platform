-- Manchester High School: the school day as the school described it (migration 088 must be applied first).
--
--   Bell times: Monday to Friday, 8:00 am to 3:00 pm, seven one-hour periods (a class can last 2 periods, see the timetable builder).
--   Lunch: Grades 7 to 9 at 11:00 am to 12:00 pm; Grades 10 to 12 at 12:00 pm to 1:00 pm.
--
-- Everything here can be changed afterwards on the School day page (school admin, vice principals, principal).
-- Devotion, clubs and societies and other events are deliberately NOT added: the school adds them itself.
-- Safe to run more than once: periods are only added if the school year has none, and each lunch window only if there is none yet.
-- To undo: delete the rows on the School day page (or: delete from school_day_blocks where kind = 'lunch').

begin;

do $$
declare
  v_year text := public.school_year_for(current_date);
begin
  if not exists (select 1 from timetable_periods where academic_year = v_year) then
    insert into timetable_periods (name, start_time, end_time, order_index, academic_year)
    select 'Period ' || n, make_time(7 + n, 0, 0), make_time(8 + n, 0, 0), n - 1, v_year from generate_series(1, 7) n;
  end if;

  if not exists (select 1 from school_day_blocks where kind = 'lunch' and academic_year = v_year and grades = '{7,8,9}') then
    insert into school_day_blocks (kind, title, grades, days, start_time, end_time, academic_year)
    values ('lunch', 'Lunch', '{7,8,9}', '{1,2,3,4,5}', '11:00', '12:00', v_year);
  end if;
  if not exists (select 1 from school_day_blocks where kind = 'lunch' and academic_year = v_year and grades = '{10,11,12}') then
    insert into school_day_blocks (kind, title, grades, days, start_time, end_time, academic_year)
    values ('lunch', 'Lunch', '{10,11,12}', '{1,2,3,4,5}', '12:00', '13:00', v_year);
  end if;
end $$;

commit;

select 'School day set up' as result,
       (select count(*) from timetable_periods where academic_year = public.school_year_for(current_date)) as periods,
       (select count(*) from school_day_blocks where kind = 'lunch' and academic_year = public.school_year_for(current_date)) as lunch_windows;
