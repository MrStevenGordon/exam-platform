-- ====================== SCHOOL: timetable for the demo class ======================
-- Needs the school day set up first (scripts/data/manchester-school-day.sql: periods and lunch).
-- Testing Teacher teaches the demo class Mathematics five times a week, one of them a double period (two hours) on Thursday.
do $$
declare
  c record;
  v_year text := public.school_year_for(current_date);
  v_n int := 0;
  v_period uuid;
  x record;
  v_id uuid;
begin
  select * into c from demo_ctx;
  if (select count(*) from timetable_periods where academic_year = v_year) < 4 then
    raise exception 'The school day is not set up yet. Run scripts/data/manchester-school-day.sql first (it adds the periods and lunch).';
  end if;

  for x in select * from (values (1, 1, 1, 1), (2, 2, 0, 1), (3, 3, 2, 1), (4, 4, 1, 2), (5, 5, 2, 1)) as t(n, dow, period_index, span) loop
    select id into v_period from timetable_periods where academic_year = v_year and order_index = x.period_index;
    if v_period is null then continue; end if;
    begin
      v_id := pg_temp.did(8000 + x.n);
      insert into timetable_sections (id, department_id, subject, teacher_id, class_group_id, day_of_week, period_id, room, academic_year, span)
      values (v_id, c.dept, 'Mathematics', c.teacher, c.class_id, x.dow, v_period, '12', v_year, x.span);
      insert into section_enrollments (section_id, student_id) select v_id, e.student_id from enrollments e where e.class_group_id = c.class_id on conflict do nothing;
      v_n := v_n + 1;
    exception when others then
      raise notice 'Skipped timetable slot (day %, period %): %', x.dow, x.period_index + 1, sqlerrm;
    end;
  end loop;
  raise notice 'Timetable: % Mathematics lessons placed for the demo class', v_n;
end $$;
