-- ====================== LEARNING: lessons, checks, progress, catch-up, flashcards, plans, resources ======================
-- Removal of this part is added to 00-remove.sql (see the bottom of that file).

create temp table demo_lessons (n int, title text, grade int, topic text, key_terms text, steps jsonb);
insert into demo_lessons values
 (1, 'Simple Interest: Earning Money on Money You Save', 9, 'Simple interest',
  E'Principal (P): the money you start with\nRate (R): the percentage paid each year\nTime (T): the number of years\nSimple interest: I = PRT/100',
  jsonb_build_array(
   jsonb_build_object('key','engage','approved',true,'resources','[]'::jsonb,'text',E'Imagine you save $2000 in a credit union that pays 5% a year. After 3 years, how much extra money do you think you would have? Take a guess before you read on and write it down.\n\nWe will check your guess at the end of the lesson.'),
   jsonb_build_object('key','explore','approved',true,'resources','[]'::jsonb,'text',E'Work out the interest earned in one year on $2000 at 5%. Hint: 5% means 5 out of every 100.\n\nNow work out the interest for 2 years, then 3 years. What pattern do you see?'),
   jsonb_build_object('key','explain','approved',true,'resources','[]'::jsonb,'text',E'Simple interest is calculated on the original amount only, so the same interest is added every year.\n\nI = PRT / 100, where P is the principal, R is the yearly rate (%) and T is the time in years.\n\nWorked example: P = $2000, R = 5, T = 3.\nI = 2000 × 5 × 3 / 100 = $300.\nTotal amount = $2000 + $300 = $2300.'),
   jsonb_build_object('key','elaborate','approved',true,'resources','[]'::jsonb,'text',E'1. Find the simple interest on $1500 at 6% for 2 years.\n2. A loan of $800 at 5% simple interest is repaid after 18 months. How much is repaid in total?\n3. $400 earns $48 in 3 years. Find the rate.'),
   jsonb_build_object('key','evaluate','approved',true,'resources','[]'::jsonb,'text',E'Go back to your guess from the start. How close were you? Write one sentence explaining what simple interest means in your own words, then try the check questions.'))),
 (2, 'Expanding and Factorising Expressions', 9, 'Expanding and factorising expressions',
  E'Expand: multiply out brackets\nFactorise: write as a product with brackets\nCommon factor: a number or letter that divides every term\nBinomial: an expression with two terms',
  jsonb_build_array(
   jsonb_build_object('key','engage','approved',true,'resources','[]'::jsonb,'text',E'A school orders 5 boxes of pens. Each box holds (2p + 3) pens, where p is an unknown pack size. How many pens in total? Think about what happens when you multiply a number by everything inside a bracket.'),
   jsonb_build_object('key','explore','approved',true,'resources','[]'::jsonb,'text',E'Draw a rectangle that is (x + 3) long and 2 wide. Split it into two parts and find each area. Add them. What do you notice about 2(x + 3) and 2x + 6?'),
   jsonb_build_object('key','explain','approved',true,'resources','[]'::jsonb,'text',E'Expanding: multiply the outside term by every term inside the bracket. 3(x + 4) = 3x + 12.\n\nTwo brackets: (x + 2)(x + 5) = x² + 5x + 2x + 10 = x² + 7x + 10.\n\nFactorising is expanding in reverse: find the common factor. 6x + 9 = 3(2x + 3).'),
   jsonb_build_object('key','elaborate','approved',true,'resources','[]'::jsonb,'text',E'Expand: 4(x − 2), (x + 3)(x + 4), (x − 1)(x + 6).\nFactorise: 10x + 15, x² + 7x + 12.'),
   jsonb_build_object('key','evaluate','approved',true,'resources','[]'::jsonb,'text',E'Pick one expression you expanded and factorise your answer to get back to the start. Explain why that works. Then try the check questions.'))),
 (3, 'Pythagoras'' Theorem', 9, 'Pythagoras'' theorem',
  E'Right-angled triangle: has one angle of 90 degrees\nHypotenuse: the longest side, opposite the right angle\nLegs: the two shorter sides\nPythagorean triple: whole numbers that fit a² + b² = c²',
  jsonb_build_array(
   jsonb_build_object('key','engage','approved',true,'resources','[]'::jsonb,'text',E'A ladder 5 m long leans against a wall with its foot 3 m from the wall. How high up the wall does it reach? Sketch it and guess before you read on.'),
   jsonb_build_object('key','explore','approved',true,'resources','[]'::jsonb,'text',E'On squared paper draw a right-angled triangle with legs 3 and 4. Draw a square on each side and count the small squares. What is special about the two smaller squares and the biggest one?'),
   jsonb_build_object('key','explain','approved',true,'resources','[]'::jsonb,'text',E'In a right-angled triangle, the square on the hypotenuse equals the sum of the squares on the other two sides: a² + b² = c².\n\nExample: legs 6 and 8. c² = 36 + 64 = 100, so c = 10.\n\nFinding a leg: subtract. If c = 13 and a = 5, then b² = 169 − 25 = 144, so b = 12.'),
   jsonb_build_object('key','elaborate','approved',true,'resources','[]'::jsonb,'text',E'1. Legs 9 and 12: find the hypotenuse.\n2. Hypotenuse 17, one leg 8: find the other leg.\n3. Is a triangle with sides 7, 24 and 25 right-angled? Show why.'),
   jsonb_build_object('key','evaluate','approved',true,'resources','[]'::jsonb,'text',E'Return to the ladder. Work out the height and check it against your guess. Then try the check questions.')));

insert into learning_lessons (id, teacher_id, title, subject, grade, topic_id, key_terms, steps, status, published_at, created_at, updated_at)
select pg_temp.did(7000 + l.n), c.teacher, l.title, 'Mathematics', l.grade,
       (select id from curriculum_topics ct where lower(btrim(ct.subject)) = 'mathematics' and ct.grade = 9 and lower(btrim(ct.name)) = lower(btrim(l.topic)) and ct.status <> 'archived' order by ct.created_at limit 1),
       l.key_terms, l.steps, 'published', (pg_temp.wk(45 - l.n * 12))::timestamptz, (pg_temp.wk(48 - l.n * 12))::timestamptz, (pg_temp.wk(45 - l.n * 12))::timestamptz
from demo_lessons l cross join demo_ctx c;

-- assignments: lesson 1 closed (due long ago, a few unfinished), lesson 2 open with a catch-up, lesson 3 upcoming
insert into learning_assignments (id, lesson_id, class_group_id, assigned_by, due_date, keep_open, created_at, taught_on)
select pg_temp.did(7100 + x.n), pg_temp.did(7000 + x.n), c.class_id, c.teacher, x.due, false, x.created, x.taught
from demo_ctx c cross join (values (1, pg_temp.wk(24), (pg_temp.wk(33))::timestamptz, pg_temp.wk(34)), (2, current_date + 5, (pg_temp.wk(10))::timestamptz, pg_temp.wk(9)), (3, current_date + 6, (pg_temp.wk(1))::timestamptz, null::date)) as x(n, due, created, taught);

-- the day lesson 2 was taught, four students (including Testing Student) were away: they get the catch-up
create temp table demo_away as
select s.student, s.idx from demo_students s cross join demo_ctx c
where s.student = c.student or s.idx in (3, 8, 14) order by (s.student = c.student) desc limit 4;

-- progress
create temp table demo_prog (lesson_n int, student uuid, steps text[], done boolean, ability numeric);
insert into demo_prog
select 1, s.student, case when pg_temp.rnd(s.student::text || 'p1') < 0.88 or s.student = c.student then array['engage','explore','explain','elaborate','evaluate'] else array['engage','explore'] end, null, s.ability
from demo_students s cross join demo_ctx c;
insert into demo_prog
select 2, s.student,
       case when s.student = c.student then array['engage']::text[]   -- away that day, has only just started the catch-up
            when s.student in (select student from demo_away) then null
            when pg_temp.rnd(s.student::text || 'p2') < 0.62 then array['engage','explore','explain','elaborate','evaluate']
            when pg_temp.rnd(s.student::text || 'p2') < 0.85 then array['engage','explore','explain'] else null end, null, s.ability
from demo_students s cross join demo_ctx c;
insert into demo_prog select 3, c.student, array['engage','explore'], null, 0.5 from demo_ctx c;
update demo_prog set done = (steps @> array['engage','explore','explain','elaborate','evaluate']);

insert into learning_progress (lesson_id, student_id, steps_done, started_at, last_activity_at, completed_at)
select pg_temp.did(7000 + p.lesson_n), p.student, p.steps,
       (pg_temp.wk(case p.lesson_n when 1 then 32 when 2 then 8 else 1 end) + time '14:05' + (pg_temp.rnd(p.student::text || p.lesson_n::text) * interval '5 hours')) at time zone 'America/Jamaica',
       (pg_temp.wk(case p.lesson_n when 1 then 30 when 2 then 6 else 1 end) + time '16:20') at time zone 'America/Jamaica',
       case when p.done then (pg_temp.wk(case p.lesson_n when 1 then 29 when 2 then 5 else 1 end) + time '16:20') at time zone 'America/Jamaica' end
from demo_prog p where p.steps is not null;

-- check questions, three levels per lesson
create temp table demo_cq (lesson_n int, level text, pos int, kind text, prompt text, opts jsonb, idx int, num numeric, expl text);
insert into demo_cq values
 (1,'support',1,'multiple_choice','In I = PRT/100, what does P stand for?','["Principal","Percentage","Payment","Period"]',0,null,'P is the principal: the money you start with.'),
 (1,'support',2,'numeric','What is the simple interest on $100 at 5% for 1 year?',null,null,5,'I = 100 × 5 × 1 / 100 = 5.'),
 (1,'core',1,'numeric','Find the simple interest on $2000 at 5% for 3 years.',null,null,300,'I = 2000 × 5 × 3 / 100 = 300.'),
 (1,'core',2,'numeric','Find the simple interest on $500 at 4% for 2 years.',null,null,40,'I = 500 × 4 × 2 / 100 = 40.'),
 (1,'core',3,'multiple_choice','$1000 is borrowed at 6% simple interest for 2 years. How much is repaid in total?','["$120","$1060","$1120","$1200"]',2,null,'Interest = 120, so total = 1000 + 120 = 1120.'),
 (1,'stretch',1,'numeric','A sum earns $144 simple interest in 3 years at 6% per year. Find the principal.',null,null,800,'P = 100 × I / (R × T) = 14400 / 18 = 800.'),
 (1,'stretch',2,'multiple_choice','Which has the bigger effect on simple interest?','["Doubling the principal","Doubling the rate","They have the same effect","Neither changes it"]',2,null,'Interest is proportional to both, so doubling either doubles the interest.'),
 (2,'support',1,'multiple_choice','Expand 2(x + 3).','["2x + 3","2x + 6","x + 6","2x + 5"]',1,null,'Multiply both terms by 2.'),
 (2,'support',2,'numeric','What is the value of 2(x + 3) when x = 1?',null,null,8,'2 × (1 + 3) = 8.'),
 (2,'core',1,'multiple_choice','Expand (x + 1)(x + 2).','["x² + 3x + 2","x² + 2","x² + 3x + 3","2x + 3"]',0,null,'x² + 2x + x + 2 = x² + 3x + 2.'),
 (2,'core',2,'multiple_choice','Factorise 4x + 8.','["4(x + 2)","2(x + 4)","4(x + 8)","x(4 + 8)"]',0,null,'4 is a common factor of 4x and 8.'),
 (2,'core',3,'numeric','What is (x + 3)(x + 4) when x = 2?',null,null,30,'5 × 6 = 30.'),
 (2,'stretch',1,'multiple_choice','Factorise x² − 9.','["(x − 3)(x + 3)","(x − 3)²","(x + 9)(x − 1)","x(x − 9)"]',0,null,'A difference of two squares.'),
 (2,'stretch',2,'numeric','A rectangle has area (x + 5)(x + 2). Find the area when x = 3.',null,null,40,'8 × 5 = 40.'),
 (3,'support',1,'multiple_choice','What is the longest side of a right-angled triangle called?','["Hypotenuse","Adjacent","Opposite","Base"]',0,null,'It is opposite the right angle.'),
 (3,'support',2,'numeric','What is 3² + 4²?',null,null,25,'9 + 16 = 25.'),
 (3,'core',1,'numeric','The legs are 5 and 12. Find the hypotenuse.',null,null,13,'25 + 144 = 169, and the square root of 169 is 13.'),
 (3,'core',2,'numeric','The hypotenuse is 10 and one leg is 6. Find the other leg.',null,null,8,'100 − 36 = 64, and the square root is 8.'),
 (3,'core',3,'multiple_choice','Which set is NOT a right-angled triangle?','["3, 4, 5","5, 12, 13","6, 8, 10","4, 5, 6"]',3,null,'16 + 25 = 41, which is not 36.'),
 (3,'stretch',1,'numeric','Find the length of the diagonal of a 9 by 12 rectangle.',null,null,15,'81 + 144 = 225, and the square root is 15.'),
 (3,'stretch',2,'multiple_choice','A 5 m ladder has its foot 3 m from a wall. How high does it reach?','["4 m","3 m","5 m","8 m"]',0,null,'25 − 9 = 16, and the square root is 4.');
insert into learning_check_questions (id, lesson_id, position, kind, prompt, options, correct_index, correct_number, tolerance, explanation, level)
select pg_temp.did(7200 + q.lesson_n * 20 + (case q.level when 'support' then 0 when 'core' then 5 else 10 end) + q.pos), pg_temp.did(7000 + q.lesson_n), q.pos, q.kind, q.prompt, q.opts, q.idx, q.num, case when q.kind = 'numeric' then 0 end, q.expl, q.level
from demo_cq q;

-- first attempts for students who finished lessons 1 and 2, at the level that suits them; a few tried again
insert into learning_check_attempts (lesson_id, student_id, attempt_no, answers, results, score, max_score, submitted_at, level)
select pg_temp.did(7000 + t.lesson_n), t.student, 1,
       jsonb_object_agg(t.qid::text, case when t.ok then (case when t.kind = 'multiple_choice' then t.idx::text else t.num::text end) else (case when t.kind = 'multiple_choice' then ((t.idx + 1) % 4)::text else (t.num + 1)::text end) end),
       jsonb_agg(jsonb_build_object('question_id', t.qid, 'correct', t.ok) order by t.pos),
       count(*) filter (where t.ok), count(*), max(t.at), max(t.level)
from (
  select p.lesson_n, p.student, q.kind, q.idx, q.num, q.pos, q.level, pg_temp.did(7200 + q.lesson_n * 20 + (case q.level when 'support' then 0 when 'core' then 5 else 10 end) + q.pos) as qid,
         pg_temp.rnd(p.student::text || q.lesson_n::text || q.level || q.pos::text) < greatest(0.1, least(0.95, p.ability + case q.level when 'support' then 0.25 when 'stretch' then -0.2 else 0 end)) as ok,
         (pg_temp.wk(case p.lesson_n when 1 then 29 else 5 end) + time '16:30') at time zone 'America/Jamaica' as at
  from demo_prog p
  join demo_cq q on q.lesson_n = p.lesson_n and q.level = (case when p.ability < 0.48 then 'support' when p.ability > 0.82 then 'stretch' else 'core' end)
  where p.done and p.lesson_n in (1, 2)
) t group by t.lesson_n, t.student;

-- ---- attendance (also drives the catch-up): two weeks of morning register ----
create temp table demo_days as select d::date as day from generate_series(current_date - 21, current_date, interval '1 day') d where extract(dow from d) between 1 and 5;
insert into daily_attendance (student_id, att_date, status, marked_by, marked_at)
select s.student, d.day,
       case when exists (select 1 from demo_away a where a.student = s.student) and d.day = pg_temp.wk(9) then 'absent'
            when pg_temp.rnd(s.student::text || d.day::text) < 0.035 then 'absent'
            when pg_temp.rnd(s.student::text || d.day::text || 'l') < 0.06 then 'late' else 'present' end,
       c.teacher, (d.day + time '08:20') at time zone 'America/Jamaica'
from demo_students s cross join demo_days d cross join demo_ctx c
where d.day <= current_date
on conflict (student_id, att_date) do update set status = excluded.status, marked_by = excluded.marked_by;

-- ---- flashcards for Testing Student ----
insert into flashcard_decks (id, student_id, title, subject, created_at, updated_at)
select pg_temp.did(7500 + x.n), c.student, x.title, 'Mathematics', now() - interval '12 days', now() - interval '1 day' from demo_ctx c cross join (values (1, 'Interest and Ratios'), (2, 'Pythagoras and Lines')) as x(n, title);
insert into flashcards (id, deck_id, front, back, box, due_at, times_seen, times_correct, last_reviewed_at, created_at)
select pg_temp.did(7600 + k.n), pg_temp.did(7500 + k.deck), k.front, k.back, k.box,
       case when k.due_in <= 0 then now() - interval '1 hour' else now() + (k.due_in * interval '1 day') end, k.seen, k.correct, now() - interval '2 days', now() - interval '12 days'
from (values
 (1,1,'What is the formula for simple interest?','I = PRT / 100, where P is the principal, R the yearly rate (%) and T the time in years.',2,0,4,2),
 (2,1,'What is the principal?','The money you start with (the amount borrowed or invested).',3,0,5,4),
 (3,1,'Simple interest on $2000 at 5% for 3 years?','$300',1,0,4,1),
 (4,1,'What is the compound interest formula for the amount?','A = P(1 + r/100)^n',1,0,3,1),
 (5,1,'How does compound interest differ from simple interest?','Compound interest is also earned on the interest already added, so it grows faster.',2,1,3,2),
 (6,1,'Share $120 in the ratio 3 : 2.','$72 and $48',4,3,6,6),
 (7,1,'Simplify 24 : 36.','2 : 3',4,4,5,5),
 (8,1,'What does direct variation mean?','When one quantity increases, the other increases in the same ratio (y = kx).',3,1,4,3),
 (9,1,'What does inverse variation mean?','When one quantity increases, the other decreases so that their product stays the same (xy = k).',2,0,3,1),
 (10,2,'State Pythagoras'' theorem.','In a right-angled triangle, a² + b² = c², where c is the hypotenuse.',3,2,5,4),
 (11,2,'Gradient of the line through (1, 2) and (3, 8)?','3',2,0,3,1),
 (12,2,'What is the y-intercept of y = mx + c?','c',5,5,6,6),
 (13,2,'What is the midpoint of (2, 4) and (6, 10)?','(4, 7)',1,0,2,0),
 (14,2,'Which side is the hypotenuse?','The longest side, opposite the right angle.',4,3,5,5)
) as k(n, deck, front, back, box, due_in, seen, correct);

-- ---- two lesson plans (private to the teacher) ----
insert into lesson_plans (id, teacher_id, subject, grade, term, unit_theme, focus_strand, topic, focus_question, duration, attainment_target, specific_objective, skills, prior_learning, materials, engage, explore, explain, elaborate, evaluate, success_criteria, published_to_library, topic_id)
select pg_temp.did(7800 + x.n), c.teacher, 'Mathematics', 'Grade 9', 'Term 1', x.unit, x.strand, x.topic, x.q, '40 minutes', x.at, x.obj, 'Reasoning, calculation, communication', x.prior, x.mat, x.eng, x.exp, x.expl, x.ela, x.ev, x.sc, false,
       (select id from curriculum_topics ct where lower(btrim(ct.subject)) = 'mathematics' and ct.grade = 9 and lower(btrim(ct.name)) = lower(btrim(x.topic)) and ct.status <> 'archived' order by ct.created_at limit 1)
from demo_ctx c cross join (values
 (1, 'Consumer arithmetic', 'Number', 'Simple interest', 'How much does saving or borrowing really cost?', 'Students apply percentages and formulae to money situations.', 'Calculate simple interest, principal, rate and time.', 'Percentages of a quantity; substitution into formulae.', 'Calculators, worksheet of real credit union rates, whiteboards.',
   'Show two savings offers and ask which pays more after 3 years.', 'Students work out the interest for 1, 2 and 3 years and look for the pattern.', 'Introduce I = PRT/100 with a worked example and a table.', 'Mixed problems: find the interest, the rate, the principal and the total repaid.', 'Exit ticket: three questions at support, core and stretch level.', 'I can use I = PRT/100 and rearrange it to find any one of the four values.'),
 (2, 'Algebra', 'Algebra', 'Expanding and factorising expressions', 'How are expanding and factorising related?', 'Students expand single and double brackets and factorise common factors.', 'Expand and factorise simple expressions.', 'Substitution; the distributive property.', 'Algebra tiles or squared paper, mini whiteboards.',
   'Area puzzle: a rectangle with sides x + 3 and 2.', 'Students split the rectangle and discover 2(x + 3) = 2x + 6.', 'Model expanding, then factorising as the reverse.', 'Matching cards: expressions and their expansions.', 'Five-question quiz, then a self-mark with the key.', 'I can expand a bracket and factorise by taking out a common factor.')
) as x(n, unit, strand, topic, q, at, obj, prior, mat, eng, exp, expl, ela, ev, sc);

-- ---- department resources: links the department shares ----
-- the pin rule checks who is signed in, so act as the head of department for these inserts (this lasts only for this transaction)
select set_config('request.jwt.claims', json_build_object('sub', (select hod::text from demo_ctx), 'role', 'authenticated')::text, true);
insert into department_resources (id, department_id, created_by, title, description, kind, url, subject, grade, topic_id, pinned, pinned_by, pinned_at, created_at, updated_at)
select pg_temp.did(7900 + x.n), c.dept, case when x.by_hod then c.hod else c.teacher end, x.title, x.descr, 'link', x.url, 'Mathematics', x.grade,
       (select id from curriculum_topics ct where lower(btrim(ct.subject)) = 'mathematics' and ct.grade = 9 and lower(btrim(ct.name)) = lower(btrim(x.topic)) and ct.status <> 'archived' order by ct.created_at limit 1),
       x.pin, case when x.pin then c.hod end, case when x.pin then now() - interval '3 days' end, now() - (x.n * interval '2 days'), now() - (x.n * interval '2 days')
from demo_ctx c cross join (values
 (1, 'Desmos graphing calculator', 'Free online graphing calculator. Good for straight lines and quadratics.', 'https://www.desmos.com/calculator', 9, 'Equation of a straight line', true, true),
 (2, 'GeoGebra Classic', 'Dynamic geometry: draw triangles and check Pythagoras'' theorem.', 'https://www.geogebra.org/classic', 9, 'Pythagoras'' theorem', false, false),
 (3, 'Math is Fun: Simple interest', 'A clear plain-language explanation with worked examples.', 'https://www.mathsisfun.com/money/simple-interest.html', 9, 'Simple interest', false, false),
 (4, 'NRICH: problem-solving tasks', 'Rich tasks for stretch groups.', 'https://nrich.maths.org/', 9, null, false, false),
 (5, 'Khan Academy: Algebra', 'Short videos and practice on expanding and factorising.', 'https://www.khanacademy.org/math/algebra', 9, 'Expanding and factorising expressions', false, true)
) as x(n, title, descr, url, grade, topic, pin, by_hod);
select set_config('request.jwt.claims', '', true);
