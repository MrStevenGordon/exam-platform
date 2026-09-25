-- Manchester High School: sets up the school's real classes.
--
--   Grade 7  (1st Form)   1-1 .. 1-7      Grade 10 (4th Form)  4-1 .. 4-7
--   Grade 8  (2nd Form)   2-1 .. 2-7      Grade 11 (5th Form)  5-1 .. 5-7
--   Grade 9  (3rd Form)   3-1 .. 3-8      Grade 12 (6th Form)  6B1 .. 6B3 (Lower Sixth)
--                                                              6A1 .. 6A3 (Upper Sixth)
--
-- What it does, in one transaction:
--   1. Renames the five existing placeholder classes in place (1A -> 1-1, 2A -> 2-1, 3A -> 3-1,
--      4A -> 4-1, 5A -> 5-1). They keep their id, so every student, teacher link and exam
--      already attached to them stays attached. Their students are NOT redistributed: they
--      simply sit in the first class of their year until you move or re-import them.
--   2. Adds every other class from the list above (37 new, 42 in total). Each new class copies
--      the department and academic year of the existing classes.
--   3. Adds a unique index on the class name, because the app looks classes up by name
--      (student import and creation) and two classes with the same name would break that.
--
-- Safe to run more than once: a class that already exists is left alone, and nothing is deleted.
-- To undo: scripts/data/rollback/manchester-classes-rollback.sql
-- Nothing else (students, enrolments, teachers, exams) is touched.

begin;

do $$
declare
  template record;
begin
  select department_id, academic_year into template
  from public.class_groups
  order by created_at nulls last, name
  limit 1;

  if template.department_id is null then
    raise exception 'No existing class to copy the department and academic year from. Create one class first.';
  end if;

  -- 1. Rename the placeholders, only when they are exactly what we expect.
  update public.class_groups set name = '1-1' where name = '1A' and year_grade = 'Grade 7'  and not exists (select 1 from public.class_groups c where c.name = '1-1');
  update public.class_groups set name = '2-1' where name = '2A' and year_grade = 'Grade 8'  and not exists (select 1 from public.class_groups c where c.name = '2-1');
  update public.class_groups set name = '3-1' where name = '3A' and year_grade = 'Grade 9'  and not exists (select 1 from public.class_groups c where c.name = '3-1');
  update public.class_groups set name = '4-1' where name = '4A' and year_grade = 'Grade 10' and not exists (select 1 from public.class_groups c where c.name = '4-1');
  update public.class_groups set name = '5-1' where name = '5A' and year_grade = 'Grade 11' and not exists (select 1 from public.class_groups c where c.name = '5-1');

  -- 2. Add every class that is not there yet.
  insert into public.class_groups (name, year_grade, department_id, academic_year)
  select w.name, w.year_grade, template.department_id, template.academic_year
  from (
    select f || '-' || n as name, 'Grade ' || (f + 6) as year_grade
    from generate_series(1, 5) f
    cross join lateral generate_series(1, case f when 3 then 8 else 7 end) n
    union all
    select '6' || l || n, 'Grade 12'
    from unnest(array['B', 'A']) l
    cross join generate_series(1, 3) n
  ) w
  where not exists (select 1 from public.class_groups c where c.name = w.name);
end $$;

-- 3. The app finds a class by its name, so a name can only appear once.
create unique index if not exists class_groups_name_key on public.class_groups (name);

commit;
