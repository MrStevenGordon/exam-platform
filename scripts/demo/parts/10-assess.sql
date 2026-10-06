-- ====================== ASSESS: topics, tests, questions, results ======================
create or replace function pg_temp.did(n int) returns uuid language sql immutable as $$ select ('dd000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.rnd(k text) returns numeric language sql immutable as $$ select (abs(hashtextextended(k, 7)) % 10000) / 10000.0 $$;
-- the last weekday on or before (today minus n days), so no test is dated on a weekend
create or replace function pg_temp.wk(n int) returns date language sql stable as $$
  select case extract(dow from (current_date - n)) when 0 then current_date - n - 2 when 6 then current_date - n - 1 else current_date - n end $$;

create temp table demo_ctx (teacher uuid, hod uuid, principal uuid, student uuid, dept uuid, class_id uuid, class_name text);

do $$
declare
  v_teacher uuid; v_hod uuid; v_principal uuid; v_student uuid; v_dept uuid; v_class uuid; v_class_name text; v_n int;
begin
  select id, department_id into v_teacher, v_dept from profiles where full_name = 'Testing Teacher' and role = 'teacher' limit 1;
  select id into v_hod from profiles where full_name = 'Testing HOD' and role = 'supervisor' limit 1;
  select id into v_principal from profiles where full_name = 'Testing Principal' and role = 'principal' limit 1;
  select id into v_student from profiles where student_id = '54321' and role = 'student' limit 1;
  if v_teacher is null then raise exception 'Cannot find the account named Testing Teacher (role teacher)'; end if;
  if v_hod is null then raise exception 'Cannot find the account named Testing HOD (role supervisor)'; end if;
  if v_principal is null then raise exception 'Cannot find the account named Testing Principal (role principal)'; end if;
  if v_student is null then raise exception 'Cannot find the student with ID 54321'; end if;
  if v_dept is null then raise exception 'Testing Teacher has no department'; end if;

  -- the demo class: the Grade 9 class with the most students (the test student joins it)
  select cg.id, cg.name into v_class, v_class_name
  from class_groups cg left join enrollments e on e.class_group_id = cg.id
  where cg.year_grade = 'Grade 9' and cg.department_id = v_dept
  group by cg.id, cg.name order by count(e.id) desc, cg.name limit 1;
  if v_class is null then raise exception 'There is no Grade 9 class in the teacher''s department'; end if;

  -- Testing Student: Grade 9, in the demo class only
  update profiles set grade_level = 9 where id = v_student;
  delete from enrollments where student_id = v_student and class_group_id <> v_class;
  insert into enrollments (student_id, class_group_id) values (v_student, v_class) on conflict do nothing;
  -- Testing Teacher teaches the demo class and Mathematics
  insert into teacher_class_groups (teacher_id, class_group_id) values (v_teacher, v_class) on conflict do nothing;
  insert into teacher_subjects (teacher_id, department_id, subject)
    select v_teacher, v_dept, 'Mathematics' where not exists (select 1 from teacher_subjects where teacher_id = v_teacher and subject = 'Mathematics');
  update profiles set department_id = v_dept where id = v_hod and department_id is null;
  insert into department_subjects (department_id, subject) select v_dept, 'Mathematics' where not exists (select 1 from department_subjects where department_id = v_dept and lower(btrim(subject)) = 'mathematics');

  select count(*) into v_n from enrollments where class_group_id = v_class;
  if v_n < 12 then raise exception 'The demo class % has only % students; need at least 12', v_class_name, v_n; end if;
  insert into demo_ctx values (v_teacher, v_hod, v_principal, v_student, v_dept, v_class, v_class_name);
end $$;

-- Grade 9 Mathematics topics (added only if missing)
insert into curriculum_topics (id, code, subject, grade, unit, name, status, sort_order)
select pg_temp.did(100 + t.n), '', 'Mathematics', 9, t.unit, t.name, 'active', t.n
from (values
  (1, 'Consumer arithmetic', 'Simple interest'), (2, 'Consumer arithmetic', 'Compound interest'),
  (3, 'Ratio and proportion', 'Direct and inverse variation'), (4, 'Ratio and proportion', 'Compound ratios and rates'),
  (5, 'Algebra', 'Expanding and factorising expressions'), (6, 'Algebra', 'Solving quadratic equations'), (7, 'Algebra', 'Simultaneous linear equations'),
  (8, 'Geometry', 'Pythagoras'' theorem'), (9, 'Coordinate geometry and graphs', 'Equation of a straight line')
) as t(n, unit, name)
where not exists (select 1 from curriculum_topics c where lower(btrim(c.subject)) = 'mathematics' and c.grade = 9 and lower(btrim(c.name)) = lower(btrim(t.name)) and c.status <> 'archived');

-- ---- the tests ----
-- test_no, title, kind, days ago, duration
create temp table demo_tests as select * from (values
  (1, 'Pop Quiz: Simple Interest',                    'pop_quiz',    42, 20),
  (2, 'Weekly Test: Algebra',                         'weekly_test', 35, 30),
  (3, 'Class Test: Ratio and Variation',              'class_test',  28, 35),
  (4, 'Class Test: Pythagoras and Straight Lines',    'class_test',  21, 35),
  (5, 'Monthly Test: Interest and Equations',         'monthly',     10, 45)
) as t(test_no, title, kind, days_ago, duration);

-- test_no, order, type, question, options, correct answer, most common wrong answer, topic
create temp table demo_q (test_no int, ord int, qtype text, qtext text, opts jsonb, correct text, wrong text, topic text);
insert into demo_q values
 (1,1,'multiple_choice','Find the simple interest on $2000 at 5% per year for 3 years.','["$100","$300","$315","$600"]','$300','$315','Simple interest'),
 (1,2,'multiple_choice','Simple interest of $90 is earned on $600 at 3% per year. For how many years?','["3 years","4 years","5 years","6 years"]','5 years','3 years','Simple interest'),
 (1,3,'multiple_choice','Which is the formula for simple interest?','["I = PRT/100","I = P(1 + R)^T","I = P + R + T","I = P/RT"]','I = PRT/100','I = P(1 + R)^T','Simple interest'),
 (1,4,'multiple_choice','A loan of $5000 at 4% simple interest for 2 years. How much is repaid in total?','["$400","$5400","$5416","$5800"]','$5400','$400','Simple interest'),
 (1,5,'true_false','Simple interest is calculated on the original amount only.','["True","False"]','True','False','Simple interest'),
 (1,6,'short_answer','Find the simple interest on $1500 at 6% for 2 years (number only).',null,'180',null,'Simple interest'),
 (1,7,'multiple_choice','What is the simple interest on $800 for 18 months at 5% per year?','["$40","$60","$80","$720"]','$60','$720','Simple interest'),
 (1,8,'multiple_choice','At what rate per year does $400 earn $48 simple interest in 3 years?','["3%","4%","12%","16%"]','4%','12%','Simple interest'),
 (2,1,'multiple_choice','Expand 3(x + 4).','["3x + 4","3x + 12","x + 12","3x + 7"]','3x + 12','3x + 4','Expanding and factorising expressions'),
 (2,2,'multiple_choice','Expand (x + 2)(x + 5).','["x² + 7x + 10","x² + 10","x² + 7x + 7","2x + 7"]','x² + 7x + 10','x² + 10','Expanding and factorising expressions'),
 (2,3,'multiple_choice','Factorise 6x + 9.','["3(2x + 3)","6(x + 9)","3(2x + 9)","9(x + 6)"]','3(2x + 3)','3(2x + 9)','Expanding and factorising expressions'),
 (2,4,'multiple_choice','Factorise x² + 5x + 6.','["(x + 2)(x + 3)","(x + 1)(x + 6)","(x + 5)(x + 1)","(x − 2)(x − 3)"]','(x + 2)(x + 3)','(x + 1)(x + 6)','Expanding and factorising expressions'),
 (2,5,'multiple_choice','Expand and simplify (x − 3)².','["x² − 9","x² − 6x + 9","x² + 9","x² − 3x + 9"]','x² − 6x + 9','x² − 9','Expanding and factorising expressions'),
 (2,6,'short_answer','What is the value of 3(x + 2) when x = 4? (number only)',null,'18',null,'Expanding and factorising expressions'),
 (2,7,'multiple_choice','Solve x + y = 10 and x − y = 2. What is x?','["4","6","8","12"]','6','4','Simultaneous linear equations'),
 (2,8,'multiple_choice','For the same equations, what is y?','["2","4","6","8"]','4','6','Simultaneous linear equations'),
 (2,9,'multiple_choice','Solve 2x + y = 11 and x + y = 7. What is x?','["3","4","5","7"]','4','3','Simultaneous linear equations'),
 (2,10,'true_false','A pair of simultaneous linear equations can have exactly one solution.','["True","False"]','True','False','Simultaneous linear equations'),
 (3,1,'multiple_choice','y varies directly with x. When x = 2, y = 10. Find y when x = 5.','["20","25","30","50"]','25','20','Direct and inverse variation'),
 (3,2,'multiple_choice','4 workers finish a job in 6 days. How long will 8 workers take, working at the same rate?','["12 days","3 days","2 days","4 days"]','3 days','12 days','Direct and inverse variation'),
 (3,3,'multiple_choice','Which is an example of direct variation?','["Cost of 5 patties at a fixed price each","Time to travel 100 km as speed increases","Workers and days to finish a job","Brightness and distance from a lamp"]','Cost of 5 patties at a fixed price each','Time to travel 100 km as speed increases','Direct and inverse variation'),
 (3,4,'true_false','In inverse variation, when one quantity doubles the other halves.','["True","False"]','True','False','Direct and inverse variation'),
 (3,5,'multiple_choice','y varies inversely with x and y = 6 when x = 4. Find y when x = 3.','["6","8","12","18"]','8','12','Direct and inverse variation'),
 (3,6,'short_answer','y varies directly with x and y = 12 when x = 3. Find y when x = 7 (number only).',null,'28',null,'Direct and inverse variation'),
 (3,7,'multiple_choice','A car uses 8 litres of fuel per 100 km. How many litres for 250 km?','["16","20","25","32"]','20','25','Compound ratios and rates'),
 (3,8,'multiple_choice','Share $120 in the ratio 3 : 2. What is the larger share?','["$48","$60","$72","$80"]','$72','$48','Compound ratios and rates'),
 (3,9,'multiple_choice','A recipe uses flour and sugar in the ratio 5 : 2. With 300 g of flour, how much sugar is needed?','["60 g","120 g","150 g","750 g"]','120 g','750 g','Compound ratios and rates'),
 (3,10,'multiple_choice','Simplify the ratio 24 : 36.','["2 : 3","3 : 4","4 : 6","6 : 9"]','2 : 3','4 : 6','Compound ratios and rates'),
 (4,1,'multiple_choice','A right-angled triangle has legs of 3 cm and 4 cm. What is the hypotenuse?','["5 cm","7 cm","12 cm","25 cm"]','5 cm','7 cm','Pythagoras'' theorem'),
 (4,2,'multiple_choice','The hypotenuse is 13 cm and one leg is 5 cm. What is the other leg?','["8 cm","12 cm","18 cm","144 cm"]','12 cm','8 cm','Pythagoras'' theorem'),
 (4,3,'true_false','Pythagoras'' theorem applies to any triangle.','["True","False"]','False','True','Pythagoras'' theorem'),
 (4,4,'multiple_choice','Which set of side lengths forms a right-angled triangle?','["6, 8, 10","5, 6, 9","4, 5, 7","7, 8, 12"]','6, 8, 10','5, 6, 9','Pythagoras'' theorem'),
 (4,5,'short_answer','A right-angled triangle has legs of 6 cm and 8 cm. Find the hypotenuse in cm (number only).',null,'10',null,'Pythagoras'' theorem'),
 (4,6,'multiple_choice','What is the gradient of the line through (1, 2) and (3, 8)?','["2","3","4","6"]','3','2','Equation of a straight line'),
 (4,7,'multiple_choice','What is the y-intercept of y = 2x + 5?','["2","5","−5","7"]','5','2','Equation of a straight line'),
 (4,8,'multiple_choice','Which line is parallel to y = 3x + 1?','["y = 3x − 4","y = −3x + 1","y = x/3 + 1","y = 1 − 3x"]','y = 3x − 4','y = −3x + 1','Equation of a straight line'),
 (4,9,'true_false','The gradients of perpendicular lines multiply to −1.','["True","False"]','True','False','Equation of a straight line'),
 (4,10,'multiple_choice','What is the midpoint of (2, 4) and (6, 10)?','["(4, 7)","(8, 14)","(2, 3)","(4, 6)"]','(4, 7)','(8, 14)','Equation of a straight line'),
 (5,1,'multiple_choice','Find the simple interest on $3000 at 4% per year for 5 years.','["$120","$600","$650","$3600"]','$600','$650','Simple interest'),
 (5,2,'multiple_choice','Find the simple interest on $1200 at 5% per year for 6 months.','["$30","$60","$300","$360"]','$30','$60','Simple interest'),
 (5,3,'multiple_choice','$2500 earns $200 simple interest in 2 years. What is the yearly rate?','["2%","4%","8%","10%"]','4%','8%','Simple interest'),
 (5,4,'multiple_choice','Which is the formula for the amount A with compound interest?','["A = P(1 + r/100)^n","A = P + PRT","A = P × r × n","A = P/(1 + r)"]','A = P(1 + r/100)^n','A = P + PRT','Compound interest'),
 (5,5,'multiple_choice','$1000 is invested at 10% compound interest for 2 years. What is the final amount?','["$1100","$1200","$1210","$1220"]','$1210','$1200','Compound interest'),
 (5,6,'true_false','Over 2 or more years at the same rate, compound interest is always more than simple interest.','["True","False"]','True','False','Compound interest'),
 (5,7,'multiple_choice','Solve x² − 5x + 6 = 0.','["x = 2 or 3","x = −2 or −3","x = 1 or 6","x = 5 or 6"]','x = 2 or 3','x = −2 or −3','Solving quadratic equations'),
 (5,8,'multiple_choice','What are the solutions of x² = 49?','["x = 7","x = ±7","x = 24.5","x = 49"]','x = ±7','x = 7','Solving quadratic equations'),
 (5,9,'multiple_choice','Solve x² + 2x − 8 = 0.','["x = 2 or −4","x = −2 or 4","x = 1 or −8","x = 8 or −1"]','x = 2 or −4','x = −2 or 4','Solving quadratic equations'),
 (5,10,'short_answer','Find the discriminant of x² − 4x + 4 = 0 (number only).',null,'0',null,'Solving quadratic equations'),
 (5,11,'essay','Explain, with an example, how compound interest differs from simple interest.',null,null,null,'Compound interest');

-- topic difficulty (higher = harder for the class) so each topic ends up with a believable result
create temp table demo_topic_d as select * from (values
  ('Simple interest', .30), ('Compound interest', .25), ('Solving quadratic equations', .15), ('Direct and inverse variation', .05),
  ('Expanding and factorising expressions', -.02), ('Simultaneous linear equations', .05), ('Pythagoras'' theorem', -.12),
  ('Equation of a straight line', -.05), ('Compound ratios and rates', -.05)
) as t(topic, d);

-- test papers, links to the class, questions
insert into draft_exams (id, title, subject, created_by, instructions, status, created_at, submitted_at, reviewed_at, department_id, exam_kind,
                         direct_published, direct_published_at, duration_minutes, pass_mark, questions_per_page, target_grade, calculator_enabled, available_from, available_until)
select pg_temp.did(1000 + t.test_no), t.title, 'Mathematics', c.teacher, 'Show your working where asked. Calculators are allowed.', 'published',
       (pg_temp.wk(t.days_ago + 3))::timestamptz, null, null, c.dept, t.kind, true, (pg_temp.wk(t.days_ago) + time '09:00') at time zone 'America/Jamaica', t.duration, 50, 5, 9, true,
       (pg_temp.wk(t.days_ago) + time '09:00') at time zone 'America/Jamaica', (pg_temp.wk(t.days_ago) + time '16:00') at time zone 'America/Jamaica'
from demo_tests t cross join demo_ctx c;
insert into draft_exam_class_groups (draft_exam_id, class_group_id) select pg_temp.did(1000 + t.test_no), c.class_id from demo_tests t cross join demo_ctx c;

insert into questions (id, draft_exam_id, created_by, question_type, question_text, options, correct_answer, points, order_index, is_bank_question, topic_id, topic, essay_rubric, total_marks)
select pg_temp.did(2000 + q.test_no * 100 + q.ord), pg_temp.did(1000 + q.test_no), c.teacher, q.qtype, q.qtext, q.opts, q.correct,
       case when q.qtype = 'essay' then 4 else 1 end, q.ord, (q.test_no <= 4),
       (select id from curriculum_topics ct where lower(btrim(ct.subject)) = 'mathematics' and ct.grade = 9 and lower(btrim(ct.name)) = lower(btrim(q.topic)) and ct.status <> 'archived' order by ct.created_at limit 1),
       null,
       case when q.qtype = 'essay' then '[{"text":"States that simple interest is calculated on the original amount only","marks":1},{"text":"States that compound interest is calculated on the amount plus the interest already earned","marks":1},{"text":"Gives a correct worked example for one of the two","marks":1},{"text":"Compares the two results, or says which grows faster and why","marks":1}]'::jsonb end,
       null
from demo_q q cross join demo_ctx c;
