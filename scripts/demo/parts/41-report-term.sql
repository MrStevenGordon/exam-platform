-- ====================== REPORT CARDS: a term that covers today ======================
-- Without a current term no report card can be made and the student's report card shows an old term. This adds "Term 1" of the current school year
-- (1 Sept to 18 Dec) with report cards released, ONLY if no term already covers today (so it never doubles up on a term the school has set up).
do $$
declare
  y int := case when extract(month from current_date) >= 8 then extract(year from current_date)::int else extract(year from current_date)::int - 1 end;
begin
  if exists (select 1 from academic_terms where start_date <= current_date and end_date >= current_date) then
    raise notice 'A term already covers today: no demo term added';
    return;
  end if;
  insert into academic_terms (id, name, academic_year, start_date, end_date, report_cards_released)
  values ('dd000000-0000-4000-8000-000000009001', 'Term 1', y || '-' || (y + 1), make_date(y, 9, 1), make_date(y, 12, 18), true);
  raise notice 'Demo term added: Term 1, % to %', make_date(y, 9, 1), make_date(y, 12, 18);
end $$;

-- teacher comments and attendance for the demo class, so the demo term's report cards are not empty (only when the demo term above exists)
do $$
declare c record; n int;
begin
  if not exists (select 1 from academic_terms where id = 'dd000000-0000-4000-8000-000000009001') then return; end if;
  select * into c from demo_ctx;
  insert into report_card_comments (student_id, term_id, subject, teacher_id, comment)
  select e.student_id, 'dd000000-0000-4000-8000-000000009001', 'Mathematics', c.teacher,
         (array[
           'Works steadily in class and has improved on algebra since the first test. Keep practising word problems.',
           'A confident student who contributes well. Aim to show more working in longer questions.',
           'Needs to revise ratio and variation before the next test. Help is available at lunch time.',
           'Excellent effort this term. Consistently hands work in on time and asks good questions.',
           'Good progress on equations. Checking answers before submitting would lift marks further.'
         ])[1 + (abs(hashtext(e.student_id::text)) % 5)]
  from enrollments e where e.class_group_id = c.class_id
  on conflict do nothing;
  insert into report_card_attendance (student_id, term_id, days_present, days_absent, days_late, conduct_comment, entered_by)
  select e.student_id, 'dd000000-0000-4000-8000-000000009001', 28 + (abs(hashtext(e.student_id::text)) % 6), abs(hashtext(e.student_id::text || 'a')) % 4, abs(hashtext(e.student_id::text || 'l')) % 3,
         (array['Polite and respectful. A pleasure to teach.', 'Well behaved and focused in class.', 'Generally good conduct; should avoid chatting during independent work.'])[1 + (abs(hashtext(e.student_id::text || 'c')) % 3)],
         c.teacher
  from enrollments e where e.class_group_id = c.class_id
  on conflict do nothing;
  get diagnostics n = row_count;
  raise notice 'Report cards: comments and attendance added for % students', n;
end $$;
