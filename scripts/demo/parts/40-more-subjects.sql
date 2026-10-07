-- ====================== SECOND PACK: English (Grade 8) and Science (Grade 10) ======================
-- Gives the HOD, principal and school admin views some contrast: two more subjects with their own classes, teachers, tests, results, lessons, timetable,
-- weekly class feedback, a support plan, flashcards, and a teacher absence with cover (one filled, one still to arrange).
-- Needs two teacher accounts named "Testing English Teacher" and "Testing Science Teacher" (each with a department), and a Grade 8 and a Grade 10 class with
-- at least 8 students. A subject whose teacher or class cannot be found is skipped with a notice. Removal is in 00-remove.sql.

create temp table more_subj as
select * from (values
  (0, 'eng', 'English Language', 'Grade 8', 8, 'Testing English Teacher'),
  (1, 'sci', 'Science', 'Grade 10', 10, 'Testing Science Teacher')
) as t(sk, k, subject, grade_label, grade, teacher_name);
alter table more_subj add column teacher uuid, add column dept uuid, add column class_id uuid, add column class_name text;
update more_subj m set teacher = p.id, dept = p.department_id from profiles p where p.full_name = m.teacher_name and p.role = 'teacher';
update more_subj m set class_id = x.id, class_name = x.name
from (select distinct on (cg.year_grade) cg.id, cg.name, cg.year_grade
      from class_groups cg join enrollments e on e.class_group_id = cg.id
      group by cg.id, cg.name, cg.year_grade having count(e.id) >= 8
      order by cg.year_grade, count(e.id) desc, cg.name) x
where x.year_grade = m.grade_label;
do $$ declare r record; begin
  for r in select * from more_subj where teacher is null or dept is null or class_id is null loop
    raise notice 'Second pack: % skipped (needs the account "%" with a department, and a % class with 8 or more students)', r.subject, r.teacher_name, r.grade_label;
  end loop;
end $$;
delete from more_subj where teacher is null or dept is null or class_id is null;

-- the teachers teach their class and subject
insert into teacher_class_groups (teacher_id, class_group_id) select m.teacher, m.class_id from more_subj m
  where not exists (select 1 from teacher_class_groups t where t.teacher_id = m.teacher and t.class_group_id = m.class_id);
insert into teacher_subjects (teacher_id, department_id, subject) select m.teacher, m.dept, m.subject from more_subj m
  where not exists (select 1 from teacher_subjects t where t.teacher_id = m.teacher and lower(btrim(t.subject)) = lower(m.subject));
insert into department_subjects (department_id, subject) select m.dept, m.subject from more_subj m
  where not exists (select 1 from department_subjects d where d.department_id = m.dept and lower(btrim(d.subject)) = lower(m.subject));

-- ---- topics ----
create temp table more_topics (k text, n int, unit text, name text, d numeric);
insert into more_topics values
 ('eng', 1, 'Reading', 'Reading and comprehension', -.10), ('eng', 2, 'Language', 'Figurative language', .25), ('eng', 3, 'Language', 'Parts of speech and grammar', -.05),
 ('eng', 4, 'Writing', 'Persuasive writing', .15), ('eng', 5, 'Literature', 'Poetry and themes', .08),
 ('sci', 1, 'Biology', 'Cells and organelles', -.05), ('sci', 2, 'Biology', 'Photosynthesis', .05), ('sci', 3, 'Physics', 'Forces and motion', .22),
 ('sci', 4, 'Chemistry', 'Acids, bases and salts', 0), ('sci', 5, 'Physics', 'Electricity', .12);
insert into curriculum_topics (id, code, subject, grade, unit, name, status, sort_order)
select pg_temp.did(200 + m.sk * 10 + t.n), '', m.subject, m.grade, t.unit, t.name, 'active', t.n
from more_topics t join more_subj m on m.k = t.k
where not exists (select 1 from curriculum_topics c where lower(btrim(c.subject)) = lower(btrim(m.subject)) and c.grade = m.grade and lower(btrim(c.name)) = lower(btrim(t.name)) and c.status <> 'archived');

-- ---- tests ----
create temp table more_tests as select * from (values
  ('eng', 1, 'Pop Quiz: Parts of Speech',                       'pop_quiz',   38, 15),
  ('eng', 2, 'Class Test: Figurative Language and Poetry',      'class_test', 24, 30),
  ('eng', 3, 'Monthly Test: Reading and Persuasive Writing',    'monthly',     9, 40),
  ('sci', 1, 'Pop Quiz: Cells and Organelles',                  'pop_quiz',   37, 15),
  ('sci', 2, 'Class Test: Photosynthesis and Forces',           'class_test', 23, 35),
  ('sci', 3, 'Monthly Test: Acids, Bases and Electricity',      'monthly',     8, 40)
) as t(k, test_no, title, kind, days_ago, duration);

insert into draft_exams (id, title, subject, created_by, instructions, status, created_at, submitted_at, reviewed_at, department_id, exam_kind,
                         direct_published, direct_published_at, duration_minutes, pass_mark, questions_per_page, target_grade, calculator_enabled, available_from, available_until)
select pg_temp.did(10000 + m.sk * 1000 + t.test_no), t.title, m.subject, m.teacher, 'Answer all questions.', 'published',
       (pg_temp.wk(t.days_ago + 3))::timestamptz, null, null, m.dept, t.kind, true, (pg_temp.wk(t.days_ago) + time '09:00') at time zone 'America/Jamaica',
       t.duration, 50, 5, m.grade, m.k = 'sci',
       (pg_temp.wk(t.days_ago) + time '09:00') at time zone 'America/Jamaica', (pg_temp.wk(t.days_ago) + time '16:00') at time zone 'America/Jamaica'
from more_tests t join more_subj m on m.k = t.k;
insert into draft_exam_class_groups (draft_exam_id, class_group_id)
select pg_temp.did(10000 + m.sk * 1000 + t.test_no), m.class_id from more_tests t join more_subj m on m.k = t.k;

-- k, test_no, order, type, question, options, correct answer, most common wrong answer, topic
create temp table more_q (k text, test_no int, ord int, qtype text, qtext text, opts jsonb, correct text, wrong text, topic text);
insert into more_q values
 ('eng',1,1,'multiple_choice','Which word is a noun in this sentence? "The ackee tree grew behind the school."','["grew","behind","tree","the"]','tree','grew','Parts of speech and grammar'),
 ('eng',1,2,'multiple_choice','Which word is the verb? "Shanice sings in the school choir."','["Shanice","sings","school","choir"]','sings','choir','Parts of speech and grammar'),
 ('eng',1,3,'multiple_choice','Which sentence is written in Standard English?','["She don''t like mangoes.","She doesn''t like mangoes.","She not like mangoes.","She didn''t likes mangoes."]','She doesn''t like mangoes.','She don''t like mangoes.','Parts of speech and grammar'),
 ('eng',1,4,'true_false','An adjective describes a noun.','["True","False"]','True','False','Parts of speech and grammar'),
 ('eng',1,5,'multiple_choice','Which word is an adverb? "The runner finished quickly."','["runner","finished","quickly","The"]','quickly','finished','Parts of speech and grammar'),
 ('eng',1,6,'short_answer','Write the plural of "child" (one word).',null,'children','childs','Parts of speech and grammar'),
 ('eng',2,1,'multiple_choice','Which sentence contains a simile?','["The classroom was a zoo.","He ran like the wind.","The wind whispered.","Time is money."]','He ran like the wind.','The classroom was a zoo.','Figurative language'),
 ('eng',2,2,'multiple_choice','Which sentence contains a metaphor?','["Her smile was as bright as the sun.","Her smile was sunshine.","Her smile brightened the room slowly.","She smiled brightly."]','Her smile was sunshine.','Her smile was as bright as the sun.','Figurative language'),
 ('eng',2,3,'multiple_choice','"The mango tree waved at us as we passed." is an example of:','["Simile","Metaphor","Personification","Hyperbole"]','Personification','Metaphor','Figurative language'),
 ('eng',2,4,'multiple_choice','"I have told you a million times!" is an example of:','["Simile","Metaphor","Personification","Hyperbole"]','Hyperbole','Metaphor','Figurative language'),
 ('eng',2,5,'true_false','A simile compares two things using "like" or "as".','["True","False"]','True','False','Figurative language'),
 ('eng',2,6,'multiple_choice','In a poem, a stanza is:','["A line that rhymes","A group of lines forming a unit","The title","The name of the poet"]','A group of lines forming a unit','A line that rhymes','Poetry and themes'),
 ('eng',2,7,'multiple_choice','A poem describes the first rain after a long drought, with farmers smiling and children dancing. The main theme is most likely:','["Fear of storms","Joy and relief","Boredom","Anger"]','Joy and relief','Fear of storms','Poetry and themes'),
 ('eng',2,8,'short_answer','Name the sound device in "slippery snakes slither" (one word).',null,'alliteration','rhyme','Poetry and themes'),
 ('eng',3,1,'multiple_choice','Read: "Every morning, Marcus walks two kilometres to school because the bus fare has gone up again. He leaves home at 6:00 a.m. so that he is never late. His teacher says he has not missed a day this term." Why does Marcus walk to school?','["He enjoys exercise","The bus fare has gone up","His teacher asked him to","The bus is full"]','The bus fare has gone up','He enjoys exercise','Reading and comprehension'),
 ('eng',3,2,'multiple_choice','What does the passage suggest about Marcus?','["He is determined","He is careless","He is lazy","He is unwell"]','He is determined','He is careless','Reading and comprehension'),
 ('eng',3,3,'multiple_choice','In the passage, "never" in "he is never late" means:','["Always","At no time","Sometimes","Rarely"]','At no time','Rarely','Reading and comprehension'),
 ('eng',3,4,'true_false','The passage says Marcus has missed several days this term.','["True","False"]','False','True','Reading and comprehension'),
 ('eng',3,5,'multiple_choice','Which is the strongest opening for a persuasive speech about school lunch prices?','["Lunch is food.","Every day, hungry students sit through afternoon classes because lunch costs too much.","I think lunch is a thing.","Hello, this is my speech."]','Every day, hungry students sit through afternoon classes because lunch costs too much.','Lunch is food.','Persuasive writing'),
 ('eng',3,6,'multiple_choice','A persuasive writer uses facts mainly to:','["Entertain the reader","Support the argument","Confuse the reader","Fill space"]','Support the argument','Entertain the reader','Persuasive writing'),
 ('eng',3,7,'essay','Write a short paragraph (4 to 6 sentences) persuading your principal to allow students to bring a reusable water bottle to class.',null,null,null,'Persuasive writing'),
 ('sci',1,1,'multiple_choice','Which organelle controls the activities of the cell?','["Nucleus","Mitochondrion","Vacuole","Cell wall"]','Nucleus','Mitochondrion','Cells and organelles'),
 ('sci',1,2,'multiple_choice','Which organelle releases energy from food in respiration?','["Chloroplast","Nucleus","Mitochondrion","Ribosome"]','Mitochondrion','Chloroplast','Cells and organelles'),
 ('sci',1,3,'multiple_choice','Which structure is found in plant cells but NOT in animal cells?','["Cell membrane","Cell wall","Cytoplasm","Nucleus"]','Cell wall','Cell membrane','Cells and organelles'),
 ('sci',1,4,'true_false','Chloroplasts contain chlorophyll.','["True","False"]','True','False','Cells and organelles'),
 ('sci',1,5,'multiple_choice','Where are proteins made in a cell?','["Ribosomes","Vacuole","Cell wall","Nucleus"]','Ribosomes','Nucleus','Cells and organelles'),
 ('sci',1,6,'short_answer','Name the jelly-like substance where chemical reactions happen in a cell (one word).',null,'cytoplasm','nucleus','Cells and organelles'),
 ('sci',2,1,'multiple_choice','Which is the word equation for photosynthesis?','["Carbon dioxide + water → glucose + oxygen","Glucose + oxygen → carbon dioxide + water","Oxygen + water → glucose","Glucose → carbon dioxide + oxygen"]','Carbon dioxide + water → glucose + oxygen','Glucose + oxygen → carbon dioxide + water','Photosynthesis'),
 ('sci',2,2,'multiple_choice','Which gas do plants take in for photosynthesis?','["Oxygen","Nitrogen","Carbon dioxide","Hydrogen"]','Carbon dioxide','Oxygen','Photosynthesis'),
 ('sci',2,3,'true_false','Photosynthesis needs light energy.','["True","False"]','True','False','Photosynthesis'),
 ('sci',2,4,'multiple_choice','Where in a leaf does most photosynthesis happen?','["Palisade cells","Root hairs","Stem","Flower"]','Palisade cells','Root hairs','Photosynthesis'),
 ('sci',2,5,'multiple_choice','A car of mass 1000 kg accelerates at 2 m/s². What is the resultant force?','["500 N","1002 N","2000 N","20 000 N"]','2000 N','500 N','Forces and motion'),
 ('sci',2,6,'short_answer','A force of 20 N acts on a mass of 5 kg. Find the acceleration in m/s² (number only).',null,'4','100','Forces and motion'),
 ('sci',2,7,'multiple_choice','Which quantity has both size and direction?','["Speed","Mass","Velocity","Time"]','Velocity','Speed','Forces and motion'),
 ('sci',2,8,'multiple_choice','A cyclist travels 600 m in 50 s. What is the average speed?','["8 m/s","10 m/s","12 m/s","30 000 m/s"]','12 m/s','10 m/s','Forces and motion'),
 ('sci',3,1,'multiple_choice','Which pH value shows a strong acid?','["1","7","10","14"]','1','7','Acids, bases and salts'),
 ('sci',3,2,'multiple_choice','Which indicator turns red in acid and blue in alkali?','["Litmus","Universal indicator","Phenolphthalein","Methyl orange"]','Litmus','Methyl orange','Acids, bases and salts'),
 ('sci',3,3,'multiple_choice','Hydrochloric acid reacts with sodium hydroxide. The products are:','["Salt and water","Salt and hydrogen","Water only","Carbon dioxide and water"]','Salt and water','Salt and hydrogen','Acids, bases and salts'),
 ('sci',3,4,'true_false','A neutral solution has a pH of 7.','["True","False"]','True','False','Acids, bases and salts'),
 ('sci',3,5,'multiple_choice','Which unit is used to measure electric current?','["Volt","Ampere","Ohm","Watt"]','Ampere','Volt','Electricity'),
 ('sci',3,6,'short_answer','A resistor of 4 Ω carries a current of 3 A. Find the voltage across it in volts (number only).',null,'12','7','Electricity'),
 ('sci',3,7,'multiple_choice','In a series circuit, if one bulb breaks, the other bulbs:','["Stay on","Go off","Get brighter","Flash"]','Go off','Stay on','Electricity'),
 ('sci',3,8,'multiple_choice','Which material is a good electrical conductor?','["Rubber","Plastic","Copper","Glass"]','Copper','Rubber','Electricity');

insert into questions (id, draft_exam_id, created_by, question_type, question_text, options, correct_answer, points, order_index, is_bank_question, topic_id, topic, essay_rubric, total_marks)
select pg_temp.did(12000 + m.sk * 1000 + q.test_no * 100 + q.ord), pg_temp.did(10000 + m.sk * 1000 + q.test_no), m.teacher, q.qtype, q.qtext, q.opts, q.correct,
       case when q.qtype = 'essay' then 4 else 1 end, q.ord, false,
       (select id from curriculum_topics ct where lower(btrim(ct.subject)) = lower(btrim(m.subject)) and ct.grade = m.grade and lower(btrim(ct.name)) = lower(btrim(q.topic)) and ct.status <> 'archived' order by ct.created_at limit 1),
       null,
       case when q.qtype = 'essay' then '[{"text":"States a clear opinion or position","marks":1},{"text":"Gives at least two reasons or facts to support it","marks":1},{"text":"Speaks to the reader respectfully and persuasively","marks":1},{"text":"Uses correct spelling, punctuation and Standard English","marks":1}]'::jsonb end,
       null
from more_q q join more_subj m on m.k = q.k;

-- ---- students and how they do ----
create temp table more_students as
select m.k, m.sk, e.student_id as student, row_number() over (partition by m.k order by e.student_id) as idx, 0.38 + 0.52 * pg_temp.rnd(e.student_id::text || m.k) as ability
from more_subj m join enrollments e on e.class_group_id = m.class_id;

create temp table more_sit as
select s.k, s.sk, s.student, s.idx, s.ability, t.test_no, pg_temp.did(20000 + s.sk * 10000 + t.test_no * 100 + s.idx::int) as session_id,
       pg_temp.did(10000 + s.sk * 1000 + t.test_no) as draft_id,
       (pg_temp.wk(t.days_ago) + time '10:15' + (s.idx * interval '20 seconds')) at time zone 'America/Jamaica' as started, t.duration, (t.test_no < 3) as released
from more_students s join more_tests t on t.k = s.k
where pg_temp.rnd(s.student::text || s.k || t.test_no::text) > 0.07;

insert into exam_sessions (id, draft_exam_id, student_id, status, started_at, completed_at, tab_switch_count, flagged, time_limit_seconds, results_released, option_shuffle_seed, password_verified, violation_log)
select x.session_id, x.draft_id, x.student, 'completed', x.started, x.started + (x.duration - 3 - floor(pg_temp.rnd(x.session_id::text) * 8)::int) * interval '1 minute',
       case when pg_temp.rnd(x.session_id::text || 'tab') > 0.97 then 4 when pg_temp.rnd(x.session_id::text || 'tab') > 0.93 then 1 else 0 end,
       (pg_temp.rnd(x.session_id::text || 'tab') > 0.97),
       x.duration * 60, x.released, floor(pg_temp.rnd(x.session_id::text || 'seed') * 100000)::int, true, '[]'::jsonb
from more_sit x;
update exam_sessions s set violation_log = (
  select jsonb_agg(jsonb_build_object('reason', 'Switched to another tab or window', 'timestamp', (s.started_at + (n * interval '4 minutes')), 'count', n)) from generate_series(1, s.tab_switch_count) n)
where pg_temp.is_demo(s.id) and s.tab_switch_count > 0 and s.violation_log = '[]'::jsonb;

create temp table more_items as
select x.session_id, x.student, x.ability, x.k, q.id as question_id, q.question_type, q.options, q.correct_answer, q.points, q.order_index,
       coalesce(mq.wrong, '') as wrong, greatest(0.08, least(0.97, x.ability - coalesce(td.d, 0) + 0.14)) as p
from more_sit x
join questions q on q.draft_exam_id = x.draft_id
join more_q mq on pg_temp.did(12000 + x.sk * 1000 + mq.test_no * 100 + mq.ord) = q.id and mq.k = x.k
left join curriculum_topics ct on ct.id = q.topic_id
left join more_topics td0 on lower(td0.name) = lower(ct.name) and td0.k = x.k
left join (select name, k, d from more_topics) td on td.k = x.k and lower(td.name) = lower(ct.name);
alter table more_items add column is_right boolean, add column ans text, add column essay_marked boolean, add column essay_marks int;
update more_items set is_right = pg_temp.rnd(session_id::text || question_id::text) < p where question_type <> 'essay';
update more_items i set ans = case
    when question_type = 'essay' then null
    when is_right then correct_answer
    when question_type = 'short_answer' then wrong
    when pg_temp.rnd(session_id::text || question_id::text || 'w') < 0.65 then wrong
    else coalesce((select o from jsonb_array_elements_text(i.options) o where o <> i.correct_answer and o <> i.wrong order by o limit 1), wrong)
  end;
update more_items set essay_marked = pg_temp.rnd(session_id::text || 'marked') < 0.40,
                      essay_marks = greatest(1, least(4, round(ability * 4 + (pg_temp.rnd(session_id::text || 'em') - 0.5))::int))
where question_type = 'essay';

insert into responses (session_id, question_id, answer, points_awarded, graded_by, graded_at)
select i.session_id, i.question_id,
       case when i.question_type = 'essay' then
         (array[
           'Students should be allowed to bring a reusable water bottle to class. First, drinking water helps us concentrate, especially in the afternoon heat. Second, it saves money and reduces plastic waste around the school. I respectfully ask you to allow this so every student can stay healthy and focused.',
           'I think we should be allowed water bottles because we get thirsty. It is hot in the classroom. Also it is better than buying drinks from the shop.',
           'Water bottle is good for school. We need water. Please let us bring it.'
         ])[1 + floor(pg_temp.rnd(i.session_id::text || 'txt') * 3)::int]
       else i.ans end,
       case when i.question_type = 'essay' then (case when i.essay_marked then i.essay_marks end) when i.is_right then i.points else 0 end,
       case when i.question_type = 'essay' and i.essay_marked then (select m.teacher from more_subj m where m.k = i.k) end,
       case when i.question_type = 'essay' and i.essay_marked then now() - interval '2 days' end
from more_items i;
insert into marking_point_responses (response_id, point_index, points_awarded, graded_by, graded_at)
select r.id, p.n - 1, case when p.n <= r.points_awarded then 1 else 0 end, r.graded_by, r.graded_at
from responses r join more_items i on i.session_id = r.session_id and i.question_id = r.question_id and i.question_type = 'essay' and i.essay_marked
cross join generate_series(1, 4) p(n);
update exam_sessions s set
  total_score = t.got, max_possible_score = t.maxp,
  fully_graded = not exists (select 1 from responses r join questions q on q.id = r.question_id where r.session_id = s.id and q.question_type = 'essay' and r.points_awarded is null)
from (select r.session_id, sum(coalesce(r.points_awarded, 0)) as got, sum(q.points) as maxp from responses r join questions q on q.id = r.question_id group by r.session_id) t
where t.session_id = s.id and pg_temp.is_demo(s.id) and s.draft_exam_id in (select draft_id from more_sit);

-- ---- lessons, checks, progress ----
create temp table more_lessons (k text, title text, topic text, key_terms text, steps jsonb);
insert into more_lessons values
 ('eng', 'Figurative Language: Simile, Metaphor and Personification', 'Figurative language',
  E'Simile: compares using "like" or "as"\nMetaphor: says one thing is another\nPersonification: gives human qualities to a thing\nHyperbole: deliberate exaggeration',
  jsonb_build_array(
   jsonb_build_object('key','engage','approved',true,'resources','[]'::jsonb,'text',E'Read this line aloud: "The sun was a hot coin over the Blue Mountains." Is the sun really a coin? Talk to a partner: why would a writer say it this way?'),
   jsonb_build_object('key','explore','approved',true,'resources','[]'::jsonb,'text',E'Sort these into piles: "as busy as a bee", "the road was a ribbon", "the wind sang through the cane fields", "I am so hungry I could eat a horse". What makes the piles different?'),
   jsonb_build_object('key','explain','approved',true,'resources','[]'::jsonb,'text',E'A simile compares using "like" or "as": "He ran like the wind."\nA metaphor says one thing IS another: "Her smile was sunshine."\nPersonification gives human actions to a thing: "The mango tree waved at us."\nHyperbole exaggerates on purpose: "I have told you a million times."'),
   jsonb_build_object('key','elaborate','approved',true,'resources','[]'::jsonb,'text',E'Write four sentences about a market day in your parish, one with a simile, one with a metaphor, one with personification and one with hyperbole.'),
   jsonb_build_object('key','evaluate','approved',true,'resources','[]'::jsonb,'text',E'Swap sentences with a partner and name the device in each. Then try the check questions.'))),
 ('sci', 'Photosynthesis: How Plants Make Food', 'Photosynthesis',
  E'Photosynthesis: plants make glucose using light\nChlorophyll: the green pigment that absorbs light\nStomata: tiny holes in a leaf that let gases in and out\nGlucose: the sugar plants make',
  jsonb_build_array(
   jsonb_build_object('key','engage','approved',true,'resources','[]'::jsonb,'text',E'A banana plant in the yard grows taller every week, but nobody feeds it. Where do you think its food comes from? Write your idea before you read on.'),
   jsonb_build_object('key','explore','approved',true,'resources','[]'::jsonb,'text',E'Look at a leaf from a plant that grew in sunlight and one that grew in a dark cupboard. What do you notice? What might the plant need that the dark one did not get?'),
   jsonb_build_object('key','explain','approved',true,'resources','[]'::jsonb,'text',E'Plants make their own food by photosynthesis.\n\nWord equation: carbon dioxide + water → glucose + oxygen (in light, using chlorophyll).\n\nCarbon dioxide enters through the stomata, water is taken up by the roots, and light energy is absorbed by chlorophyll in the chloroplasts. The glucose is used for energy and growth, and the oxygen is released.'),
   jsonb_build_object('key','elaborate','approved',true,'resources','[]'::jsonb,'text',E'1. Why do farmers grow crops in open, sunny fields?\n2. Predict what happens to a plant kept in the dark for a week.\n3. Draw and label a leaf to show where the gases move.'),
   jsonb_build_object('key','evaluate','approved',true,'resources','[]'::jsonb,'text',E'Return to the banana plant. Explain in three sentences where its food really comes from. Then try the check questions.')));
insert into learning_lessons (id, teacher_id, title, subject, grade, topic_id, key_terms, steps, status, published_at, created_at, updated_at)
select pg_temp.did(13000 + m.sk), m.teacher, l.title, m.subject, m.grade,
       (select id from curriculum_topics ct where lower(btrim(ct.subject)) = lower(btrim(m.subject)) and ct.grade = m.grade and lower(btrim(ct.name)) = lower(btrim(l.topic)) and ct.status <> 'archived' order by ct.created_at limit 1),
       l.key_terms, l.steps, 'published', (pg_temp.wk(20))::timestamptz, (pg_temp.wk(24))::timestamptz, (pg_temp.wk(20))::timestamptz
from more_lessons l join more_subj m on m.k = l.k;
insert into learning_assignments (id, lesson_id, class_group_id, assigned_by, due_date, keep_open, created_at, taught_on)
select pg_temp.did(13100 + m.sk), pg_temp.did(13000 + m.sk), m.class_id, m.teacher, current_date + 4, false, (pg_temp.wk(14))::timestamptz, pg_temp.wk(13) from more_subj m;
insert into learning_progress (lesson_id, student_id, steps_done, started_at, last_activity_at, completed_at)
select pg_temp.did(13000 + s.sk), s.student,
       case when pg_temp.rnd(s.student::text || 'lp' || s.k) < 0.70 then array['engage','explore','explain','elaborate','evaluate'] when pg_temp.rnd(s.student::text || 'lp' || s.k) < 0.88 then array['engage','explore','explain'] else array['engage'] end,
       (pg_temp.wk(12) + time '14:05' + (pg_temp.rnd(s.student::text || s.k) * interval '5 hours')) at time zone 'America/Jamaica',
       (pg_temp.wk(10) + time '16:20') at time zone 'America/Jamaica',
       case when pg_temp.rnd(s.student::text || 'lp' || s.k) < 0.70 then (pg_temp.wk(9) + time '16:20') at time zone 'America/Jamaica' end
from more_students s where pg_temp.rnd(s.student::text || 'has' || s.k) < 0.92;

create temp table more_cq (k text, level text, pos int, kind text, prompt text, opts jsonb, idx int, num numeric, expl text);
insert into more_cq values
 ('eng','support',1,'multiple_choice','Which device compares two things using "like" or "as"?','["Simile","Metaphor","Personification","Hyperbole"]',0,null,'A simile uses "like" or "as".'),
 ('eng','support',2,'multiple_choice','"The wind sang through the cane fields." Which device is this?','["Simile","Personification","Hyperbole","Alliteration"]',1,null,'The wind is given a human action: singing.'),
 ('eng','core',1,'multiple_choice','Which sentence is a metaphor?','["Her eyes sparkled like stars.","Her eyes were stars.","Her eyes sparkled brightly.","Her eyes were very bright indeed."]',1,null,'It says her eyes ARE stars, with no "like" or "as".'),
 ('eng','core',2,'multiple_choice','"I am so tired I could sleep for a week." Which device is this?','["Hyperbole","Simile","Metaphor","Personification"]',0,null,'It is an exaggeration on purpose.'),
 ('eng','stretch',1,'multiple_choice','Why might a writer choose a metaphor over a simile?','["It makes the comparison feel stronger and more direct","It is shorter","It is easier to spell","It always rhymes"]',0,null,'A metaphor says one thing IS another, which feels more direct.'),
 ('eng','stretch',2,'multiple_choice','Which line uses both a simile and personification?','["The moon smiled down like a friendly face.","The moon was bright.","The moon is a coin.","The moon rose at six."]',0,null,'The moon smiles (personification) and is compared "like a friendly face" (simile).'),
 ('sci','support',1,'multiple_choice','Which gas do plants take in for photosynthesis?','["Oxygen","Carbon dioxide","Nitrogen","Hydrogen"]',1,null,'Plants take in carbon dioxide.'),
 ('sci','support',2,'multiple_choice','What is the green pigment that absorbs light?','["Chlorophyll","Glucose","Starch","Protein"]',0,null,'Chlorophyll absorbs light energy.'),
 ('sci','core',1,'multiple_choice','Which are the products of photosynthesis?','["Glucose and oxygen","Carbon dioxide and water","Glucose and carbon dioxide","Oxygen and water"]',0,null,'Carbon dioxide + water → glucose + oxygen.'),
 ('sci','core',2,'multiple_choice','Where does water enter the plant?','["Roots","Stomata","Flowers","Chloroplasts"]',0,null,'Roots take up water from the soil.'),
 ('sci','stretch',1,'multiple_choice','A plant is kept in the dark for a week. What happens to its leaves?','["They turn yellow because chlorophyll cannot be made without light","They turn bright green","They grow larger","Nothing changes"]',0,null,'Without light, chlorophyll breaks down and the leaves turn yellow.'),
 ('sci','stretch',2,'multiple_choice','Which change would most increase the rate of photosynthesis on a dull day?','["More light","Less water","Fewer leaves","A cooler cupboard"]',0,null,'Light is the limiting factor on a dull day.');
insert into learning_check_questions (id, lesson_id, position, kind, prompt, options, correct_index, correct_number, tolerance, explanation, level)
select pg_temp.did(13200 + m.sk * 20 + (case q.level when 'support' then 0 when 'core' then 5 else 10 end) + q.pos), pg_temp.did(13000 + m.sk), q.pos, q.kind, q.prompt, q.opts, q.idx, q.num, null, q.expl, q.level
from more_cq q join more_subj m on m.k = q.k;

-- ---- timetable ----
create temp table more_slots (k text, n int, dow int, pidx int, span int, room text);
insert into more_slots values ('eng', 1, 1, 2, 1, 'E3'), ('eng', 2, 2, 3, 1, 'E3'), ('eng', 3, 4, 0, 1, 'E3'), ('eng', 4, 5, 3, 1, 'E3'),
                              ('sci', 1, 1, 3, 1, 'Lab 1'), ('sci', 2, 3, 1, 1, 'Lab 1'), ('sci', 3, 5, 0, 1, 'Lab 1'), ('sci', 4, 4, 4, 2, 'Lab 1');
insert into timetable_sections (id, department_id, subject, teacher_id, class_group_id, day_of_week, period_id, room, academic_year, span)
select pg_temp.did(15000 + m.sk * 10 + s.n), m.dept, m.subject, m.teacher, m.class_id, s.dow, p.id, s.room, public.school_year_for(current_date), s.span
from more_slots s join more_subj m on m.k = s.k
join timetable_periods p on p.academic_year = public.school_year_for(current_date) and p.order_index = s.pidx
where not exists (select 1 from timetable_sections t where t.teacher_id = m.teacher and t.day_of_week = s.dow and t.period_id = p.id and t.academic_year = public.school_year_for(current_date));
insert into section_enrollments (section_id, student_id)
select ts.id, e.student_id from timetable_sections ts join enrollments e on e.class_group_id = ts.class_group_id where pg_temp.is_demo(ts.id) and ts.id in (select pg_temp.did(15000 + sk * 10 + n) from more_subj cross join generate_series(1, 4) n)
on conflict do nothing;

-- ---- attendance for the two classes ----
insert into daily_attendance (student_id, att_date, status, marked_by, marked_at)
select s.student, d.day,
       case when pg_temp.rnd(s.student::text || d.day::text) < 0.04 then 'absent' when pg_temp.rnd(s.student::text || d.day::text || 'l') < 0.06 then 'late' else 'present' end,
       m.teacher, (d.day + time '08:20') at time zone 'America/Jamaica'
from more_students s join more_subj m on m.k = s.k cross join demo_days d
where d.day <= current_date
on conflict (student_id, att_date) do update set status = excluded.status, marked_by = excluded.marked_by;

-- ---- weekly class feedback, a reflection and a support plan (only when migrations 091 and 092 are applied) ----
do $$
declare
  v_this date := date_trunc('week', public.school_today())::date;
  m record; s record; w int; v_hard uuid; v_u int; v_n int := 0;
begin
  if to_regclass('public.weekly_class_feedback') is null then raise notice 'Second pack: class feedback skipped (migration 091 is not applied).'; return; end if;
  for m in select * from more_subj loop
    select id into v_hard from curriculum_topics ct where lower(btrim(ct.subject)) = lower(btrim(m.subject)) and ct.grade = m.grade
      and lower(btrim(ct.name)) = (case m.k when 'eng' then 'figurative language' else 'forces and motion' end) and ct.status <> 'archived' limit 1;
    for w in 1..2 loop
      for s in select * from more_students where k = m.k order by idx limit 22 loop
        v_u := 1 + floor(least(0.99, greatest(0, s.ability + (case w when 1 then -0.10 else 0.02 end) + (pg_temp.rnd(s.student::text || 'fb' || w::text) - 0.5) * 0.3)) * 4)::int;
        insert into weekly_class_feedback (id, student_id, week_start, subject, teacher_id, class_group_id, understanding, hardest_topic_id, needs_help, pace, engagement, clarity, support, helped, improve)
        values (pg_temp.did(21000 + m.sk * 1000 + w * 100 + s.idx::int), s.student, v_this - 7 * w, m.subject, m.teacher, m.class_id, v_u,
          case when w = 1 and v_u <= 3 and pg_temp.rnd(s.student::text || 'ht') < 0.6 then v_hard end,
          (w = 1 and v_u <= 2 and pg_temp.rnd(s.student::text || 'nh') < 0.6),
          case when v_u <= 2 then 3 when pg_temp.rnd(s.student::text || 'pc') < 0.2 then 1 else 2 end,
          2 + (pg_temp.rnd(s.student::text || 'en') > 0.5)::int + (v_u >= 3)::int, 3 + (v_u >= 3)::int, 3,
          case when pg_temp.rnd(s.student::text || 'h1') < 0.3 then 'Working through examples together' when pg_temp.rnd(s.student::text || 'h1') < 0.5 then 'The Jamaican examples made it real' end,
          case when w = 1 and pg_temp.rnd(s.student::text || 'i1') < 0.25 then 'A bit more time on the hard topic, please' end)
        on conflict do nothing;
        v_n := v_n + 1;
      end loop;
    end loop;
    insert into weekly_class_reflections (id, teacher_id, week_start, subject, class_group_id, pace_vs_plan, covered, went_well, difficult, support_needed, next_steps)
    values (pg_temp.did(21900 + m.sk), m.teacher, v_this - 7, m.subject, m.class_id, case m.k when 'eng' then 'on_track' else 'behind' end,
      case m.k when 'eng' then 'Similes and metaphors, and the start of personification.' else 'Photosynthesis, and the first part of forces and motion.' end,
      case m.k when 'eng' then 'The market-day writing task produced some lovely sentences.' else 'The leaf experiment kept everyone involved.' end,
      case m.k when 'eng' then 'Telling a metaphor from a simile.' else 'Using F = ma with units, and the acceleration questions.' end,
      case m.k when 'eng' then null else 'A short Thursday session on force and acceleration for the students who asked for help.' end,
      case m.k when 'eng' then 'A quick sorting game, then a short quiz on all four devices.' else 'Re-teach F = ma with two Jamaican examples (a bus and a bicycle), then a short quiz.' end)
    on conflict do nothing;
  end loop;
  raise notice 'Second pack: % feedback answers added', v_n;
end $$;
do $$
declare m record; s record;
begin
  if to_regclass('public.support_cases') is null then return; end if;
  select * into m from more_subj where k = 'sci';
  if not found then return; end if;
  select e.student_id as student, round(avg(100.0 * es.total_score / es.max_possible_score), 1) as avg into s
  from enrollments e join exam_sessions es on es.student_id = e.student_id and es.status = 'completed' and es.fully_graded and es.max_possible_score > 0 and es.draft_exam_id in (select pg_temp.did(10000 + 1000 + t) from generate_series(1, 3) t)
  where e.class_group_id = m.class_id group by e.student_id order by avg(100.0 * es.total_score / es.max_possible_score) limit 1;
  if s.student is null then return; end if;
  insert into support_cases (id, student_id, subject, reason, goal, owner_id, status, review_on, baseline_pct, opened_by, opened_at)
  values (pg_temp.did(10500), s.student, 'Science', 'Struggling with forces and motion, and asked for help in class feedback.', 'Reach 50% on the next Science test', m.teacher, 'open', public.school_today() + 10, s.avg, m.teacher, now() - interval '12 days');
  insert into support_actions (id, case_id, kind, note, done_on, created_by)
  values (pg_temp.did(10510), pg_temp.did(10500), 'small_group', 'Small group session on F = ma with worked examples.', public.school_today() - 5, m.teacher);
end $$;

-- ---- more flashcards for Testing Student ----
insert into flashcard_decks (id, student_id, title, subject, created_at, updated_at)
select pg_temp.did(16000 + x.n), c.student, x.title, x.subject, now() - interval '8 days', now() - interval '1 day'
from demo_ctx c cross join (values (1, 'English: Figurative Language', 'English Language'), (2, 'Science: Cells and Photosynthesis', 'Science')) as x(n, title, subject);
insert into flashcards (id, deck_id, front, back, box, due_at, times_seen, times_correct, last_reviewed_at, created_at)
select pg_temp.did(16100 + k.n), pg_temp.did(16000 + k.deck), k.front, k.back, k.box,
       case when k.due_in <= 0 then now() - interval '1 hour' else now() + (k.due_in * interval '1 day') end, k.seen, k.correct, now() - interval '2 days', now() - interval '8 days'
from (values
 (1,1,'What is a simile?','A comparison using "like" or "as", for example "He ran like the wind."',3,0,4,3),
 (2,1,'What is a metaphor?','Saying one thing IS another, for example "Her smile was sunshine."',2,0,4,2),
 (3,1,'What is personification?','Giving human actions or feelings to a thing, for example "The mango tree waved at us."',1,0,3,1),
 (4,1,'What is hyperbole?','Deliberate exaggeration, for example "I have told you a million times."',2,1,3,2),
 (5,1,'What is alliteration?','Words that start with the same sound, for example "slippery snakes slither".',4,3,5,5),
 (6,1,'What is a stanza?','A group of lines in a poem that form a unit.',4,4,5,5),
 (7,1,'What does the theme of a poem mean?','The main idea or message the poet wants you to understand.',1,0,2,0),
 (8,2,'What is the job of the nucleus?','It controls the activities of the cell.',3,1,4,3),
 (9,2,'Which organelle releases energy in respiration?','The mitochondrion.',2,0,4,2),
 (10,2,'Which structures are in plant cells but not animal cells?','Cell wall, chloroplasts and a large permanent vacuole.',1,0,3,1),
 (11,2,'Write the word equation for photosynthesis.','Carbon dioxide + water → glucose + oxygen (in light, using chlorophyll).',2,0,3,1),
 (12,2,'What is chlorophyll?','The green pigment that absorbs light for photosynthesis.',4,3,5,5),
 (13,2,'Where do gases enter and leave a leaf?','Through the stomata.',3,1,3,2),
 (14,2,'What is F = ma?','Force = mass × acceleration.',1,0,2,0)
) as k(n, deck, front, back, box, due_in, seen, correct);

-- ---- a teacher absence with cover: Testing Teacher is away on the next two school days; the first class is covered, the second still needs a teacher ----
do $$
declare
  c record; d1 date := current_date + 1; d2 date; sub uuid; s1 record; s2 record; abs_id uuid := pg_temp.did(17000); clash boolean;
begin
  if to_regclass('public.teacher_absences') is null then return; end if;
  select * into c from demo_ctx;
  select id into sub from profiles where full_name = 'Testing English Teacher' and role = 'teacher' limit 1;
  while extract(dow from d1) in (0, 6) loop d1 := d1 + 1; end loop;
  d2 := d1 + 1; while extract(dow from d2) in (0, 6) loop d2 := d2 + 1; end loop;
  select * into s1 from timetable_sections where id = pg_temp.did(8000 + extract(dow from d1)::int);
  select * into s2 from timetable_sections where id = pg_temp.did(8000 + extract(dow from d2)::int);
  if s1.id is null or s2.id is null then raise notice 'Second pack: no demo timetable to attach the absence to'; return; end if;
  insert into teacher_absences (id, teacher_id, start_date, end_date, period_ids, created_by) values (abs_id, c.teacher, d1, d2, array[s1.period_id, s2.period_id], c.teacher);
  clash := sub is null or exists (select 1 from timetable_sections t where t.teacher_id = sub and t.day_of_week = s1.day_of_week and t.period_id = s1.period_id);
  insert into substitution_assignments (id, absence_id, section_id, class_date, lesson_plan_id, learning_lesson_id, substitute_teacher_id, status, assigned_by, assigned_at)
  values (pg_temp.did(17001), abs_id, s1.id, d1, pg_temp.did(7801), null, case when clash then null else sub end, case when clash then 'unfilled' else 'assigned' end, c.hod, now()),
         (pg_temp.did(17002), abs_id, s2.id, d2, null, pg_temp.did(7003), null, 'unfilled', c.hod, now());
end $$;
