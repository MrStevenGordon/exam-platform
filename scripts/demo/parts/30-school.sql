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

-- ====================== SCHOOL: weekly class feedback (needs migration 091) ======================
-- Two weeks of anonymous-style student feedback for the demo class (about 22 students; Testing Student is left out so you can give feedback live),
-- a dip in understanding last week at Simple interest, and Testing Teacher's reflection for last week.
do $$
declare
  c record;
  v_this date := date_trunc('week', public.school_today())::date;
  v_topic uuid;
  v_n int := 0;
  s record;
  w int;
begin
  if to_regclass('public.weekly_class_feedback') is null then raise notice 'Class feedback skipped: migration 091 is not applied.'; return; end if;
  select * into c from demo_ctx;
  if not exists (select 1 from timetable_sections where class_group_id = c.class_id and teacher_id = c.teacher and academic_year = public.school_year_for(v_this)) then
    raise notice 'Class feedback skipped: the demo timetable is missing.'; return;
  end if;
  select id into v_topic from curriculum_topics where subject ilike 'mathematics' and status = 'active' and name ilike '%simple interest%' order by (id::text like 'dd000000-%') desc limit 1;

  for w in 1..2 loop                                   -- 1 = last week, 2 = the week before
    for s in select e.student_id, row_number() over (order by e.student_id) as rn
             from enrollments e where e.class_group_id = c.class_id and e.student_id <> c.student order by e.student_id limit 22 loop
      insert into weekly_class_feedback (id, student_id, week_start, subject, teacher_id, class_group_id, understanding, hardest_topic_id, needs_help, pace, engagement, clarity, support, helped, improve)
      values (pg_temp.did(9000 + w * 100 + s.rn::int), s.student_id, v_this - 7 * w, 'Mathematics', c.teacher, c.class_id,
        case when w = 2 then 3 + (s.rn % 3 = 0)::int - (s.rn % 7 = 0)::int else 2 + (s.rn % 3 = 0)::int + (s.rn % 5 = 0)::int - (s.rn % 4 = 0)::int end,
        case when w = 1 and s.rn % 2 = 0 then v_topic end,
        (w = 1 and s.rn % 6 = 0),
        case when w = 1 then (case when s.rn % 3 = 0 then 2 else 3 end) else 2 end,
        3 + (s.rn % 2), case when w = 1 then 2 + (s.rn % 2) else 3 + (s.rn % 2) end, 3,
        case when s.rn % 4 = 0 then 'Worked examples on the board' when s.rn % 4 = 1 then 'Doing questions in pairs' else null end,
        case when w = 1 and s.rn % 5 = 0 then 'Slow down a little when we start a new topic' else null end)
      on conflict do nothing;
      v_n := v_n + 1;
    end loop;
  end loop;

  insert into weekly_class_reflections (id, teacher_id, week_start, subject, class_group_id, pace_vs_plan, covered, went_well, difficult, support_needed, next_steps)
  values (pg_temp.did(9900), c.teacher, v_this - 7, 'Mathematics', c.class_id, 'behind',
    'Percentages and the start of simple interest.', 'The group work on percentage discounts in a Jamaican supermarket went well.',
    'Many students mixed up the principal and the interest in simple interest.', 'A short support session on Thursday for the students who asked for help.',
    'Recap simple interest with a worked example using a J$ savings account, then a short quiz.')
  on conflict do nothing;
  raise notice 'Class feedback: % student answers added for the demo class', v_n;
end $$;

-- ====================== SCHOOL: student support plans (needs migration 092) ======================
-- Two plans for students in the demo class: an open one for the student with the lowest Mathematics average (with two actions already recorded and a
-- review date next week), and a finished one that improved, so the Plans and Finished tabs both have something to show.
do $$
declare
  c record;
  s record;
  v_n int := 0;
  v_school numeric;
begin
  if to_regclass('public.support_cases') is null then raise notice 'Support plans skipped: migration 092 is not applied.'; return; end if;
  select * into c from demo_ctx;
  select avg(a) into v_school from (select avg(100.0 * es.total_score / es.max_possible_score) as a from exam_sessions es
     where es.status = 'completed' and es.fully_graded and es.max_possible_score > 0 group by es.student_id) q;
  for s in
    select e.student_id, round(avg(100.0 * es.total_score / es.max_possible_score), 1) as avg
    from enrollments e join exam_sessions es on es.student_id = e.student_id and es.status = 'completed' and es.fully_graded and es.max_possible_score > 0
    where e.class_group_id = c.class_id and e.student_id <> c.student
    group by e.student_id order by avg(100.0 * es.total_score / es.max_possible_score) limit 2
  loop
    v_n := v_n + 1;
    if v_n = 1 then
      insert into support_cases (id, student_id, subject, reason, goal, owner_id, status, review_on, baseline_pct, baseline_school_pct, opened_by, opened_at)
      values (pg_temp.did(9500), s.student_id, 'Mathematics', 'Averaging well below the school average in Mathematics and missed two lessons on simple interest.',
              'Raise the Mathematics average to 55% by the next test', c.teacher, 'open', public.school_today() + 7, s.avg, round(v_school, 1), c.teacher, now() - interval '18 days');
      insert into support_actions (id, case_id, kind, note, done_on, created_by) values
        (pg_temp.did(9510), pg_temp.did(9500), 'one_to_one', 'Went through percentages and simple interest at lunch.', public.school_today() - 12, c.teacher),
        (pg_temp.did(9511), pg_temp.did(9500), 'parent_contact', 'Spoke to the parent about attendance and a quiet place to study.', public.school_today() - 6, c.teacher);
    else
      insert into support_cases (id, student_id, subject, reason, goal, owner_id, status, baseline_pct, baseline_school_pct, opened_by, opened_at, closed_at, outcome, outcome_note)
      values (pg_temp.did(9501), s.student_id, 'Mathematics', 'Low marks on the first two tests.', 'Pass the next test', c.teacher, 'closed', s.avg, round(v_school, 1), c.teacher,
              now() - interval '70 days', now() - interval '20 days', 'improved', 'Peer tutor sessions worked. Passed the last two tests.');
      insert into support_actions (id, case_id, kind, note, done_on, created_by) values
        (pg_temp.did(9512), pg_temp.did(9501), 'peer_tutor', 'Paired with a Grade 9 student twice a week.', public.school_today() - 50, c.teacher);
    end if;
  end loop;
  raise notice 'Support plans: % added for the demo class', v_n;
end $$;
