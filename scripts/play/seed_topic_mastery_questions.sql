-- Original starter questions for Topic Mastery (Mathematics, Grades 7-11).
-- Authored for Play; not copied from any school's exams. Safe to re-run:
-- it only inserts when the question text is not already present.

insert into play_questions (subject, topic, question_type, question_text, options, correct_answer, points, explanation)
select v.subject, v.topic, v.qtype, v.q, v.options::jsonb, v.ans, v.pts, v.expl
from (values
  -- Algebra
  ('Mathematics','Algebra','multiple_choice','Simplify: 4x + 3x','["7x","12x","7x²","x"]','7x',1,'Add the coefficients: 4 + 3 = 7.'),
  ('Mathematics','Algebra','multiple_choice','Simplify: 5(x + 2) - 3x','["2x + 10","8x + 10","2x + 2","8x + 2"]','2x + 10',2,'5x + 10 - 3x = 2x + 10.'),
  ('Mathematics','Algebra','short_answer','Solve for x: x + 9 = 21',null,'12',1,'Subtract 9 from both sides.'),
  ('Mathematics','Algebra','short_answer','Solve for x: 3x - 4 = 14',null,'6',2,'Add 4 to get 3x = 18, then divide by 3.'),
  ('Mathematics','Algebra','true_false','The expression 2(x + 3) equals 2x + 3.',null,'false',1,'Multiply both terms: 2(x + 3) = 2x + 6.'),
  ('Mathematics','Algebra','fill_blank','If y = 2x + 1 and x = 4, then y = ____',null,'9',1,'2(4) + 1 = 9.'),
  ('Mathematics','Algebra','multiple_choice','Factorise: x² + 5x + 6','["(x + 2)(x + 3)","(x + 1)(x + 6)","(x - 2)(x - 3)","(x + 5)(x + 1)"]','(x + 2)(x + 3)',2,'Find two numbers that multiply to 6 and add to 5: 2 and 3.'),
  -- Fractions
  ('Mathematics','Fractions','multiple_choice','What is 1/2 + 1/4?','["3/4","2/6","1/6","2/4"]','3/4',1,'1/2 = 2/4, so 2/4 + 1/4 = 3/4.'),
  ('Mathematics','Fractions','multiple_choice','Which fraction is equivalent to 2/3?','["4/6","3/2","2/6","6/4"]','4/6',1,'Multiply top and bottom by 2.'),
  ('Mathematics','Fractions','short_answer','What is 3/5 of 20?',null,'12',2,'20 ÷ 5 = 4, then 4 × 3 = 12.'),
  ('Mathematics','Fractions','true_false','3/4 is larger than 2/3.',null,'true',1,'3/4 = 9/12 and 2/3 = 8/12.'),
  ('Mathematics','Fractions','fill_blank','Simplify 12/18 to its lowest terms: ____',null,'2/3',2,'Divide top and bottom by 6.'),
  ('Mathematics','Fractions','multiple_choice','What is 2/3 × 3/4?','["1/2","5/7","6/7","1/4"]','1/2',2,'6/12 simplifies to 1/2.'),
  -- Geometry
  ('Mathematics','Geometry','true_false','The angles in a triangle add up to 180 degrees.',null,'true',1,'This holds for every triangle.'),
  ('Mathematics','Geometry','short_answer','What is the area of a rectangle with length 8 cm and width 5 cm? (number only)',null,'40',1,'Area = length × width.'),
  ('Mathematics','Geometry','multiple_choice','How many degrees are in a right angle?','["90","45","180","360"]','90',1,'A right angle is a quarter turn.'),
  ('Mathematics','Geometry','short_answer','A triangle has angles of 50° and 60°. What is the third angle? (number only)',null,'70',2,'180 - 50 - 60 = 70.'),
  ('Mathematics','Geometry','multiple_choice','What is the circumference formula for a circle with radius r?','["2πr","πr²","πd²","4πr"]','2πr',2,'Circumference = 2πr. Area is πr².'),
  ('Mathematics','Geometry','fill_blank','A polygon with 6 sides is called a ____',null,'hexagon',1,'Penta = 5, hexa = 6, hepta = 7.'),
  -- Percentages
  ('Mathematics','Percentages','short_answer','What is 10% of 250?',null,'25',1,'Divide by 10.'),
  ('Mathematics','Percentages','short_answer','What is 25% of 80?',null,'20',1,'25% is one quarter: 80 ÷ 4.'),
  ('Mathematics','Percentages','multiple_choice','Write 0.35 as a percentage.','["35%","3.5%","0.35%","350%"]','35%',1,'Multiply by 100.'),
  ('Mathematics','Percentages','true_false','A 50% discount on a $200 item makes it cost $150.',null,'false',1,'50% of $200 is $100, so the price is $100.'),
  ('Mathematics','Percentages','short_answer','A price rises from $50 to $60. What is the percentage increase? (number only)',null,'20',3,'Increase 10 ÷ original 50 = 0.2 = 20%.'),
  ('Mathematics','Percentages','fill_blank','1/5 written as a percentage is ____%',null,'20',1,'1 ÷ 5 = 0.2 = 20%.')
) as v(subject, topic, qtype, q, options, ans, pts, expl)
where not exists (select 1 from play_questions p where p.question_text = v.q and p.subject = v.subject);
