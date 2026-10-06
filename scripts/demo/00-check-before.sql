-- Read-only. Run this on Manchester BEFORE the seed; it only reads. Paste the result back if anything looks wrong.
select 'Testing Teacher' as account, count(*) as found, max(department_id::text) as department from profiles where full_name = 'Testing Teacher' and role = 'teacher'
union all select 'Testing HOD', count(*), max(department_id::text) from profiles where full_name = 'Testing HOD' and role = 'supervisor'
union all select 'Testing Principal', count(*), null from profiles where full_name = 'Testing Principal' and role = 'principal'
union all select 'Student 54321', count(*), max(grade_level::text) from profiles where student_id = '54321' and role = 'student';

-- the Grade 9 classes and how many students each has (the seed uses the biggest one)
select cg.name as class, cg.year_grade, count(e.id) as students
from class_groups cg left join enrollments e on e.class_group_id = cg.id
where cg.year_grade = 'Grade 9' group by cg.name, cg.year_grade order by students desc, cg.name;

-- students whose ID is not a 5-digit number (these are what the ID script will change)
select count(*) filter (where student_id !~ '^[0-9]{5}$') as not_five_digits, count(*) as all_students from profiles where role = 'student';
