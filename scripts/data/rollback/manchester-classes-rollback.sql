-- Undoes scripts/data/manchester-classes.sql as far as it safely can:
--   * renames 1-1, 2-1, 3-1, 4-1, 5-1 back to 1A .. 5A (only if the old name is free),
--   * removes the unique index on the class name,
--   * deletes the added classes, but ONLY those nothing refers to. A class that has students,
--     teachers, a timetable, attendance or lessons attached is left in place and listed, because
--     deleting it would delete that data too.
begin;

drop index if exists public.class_groups_name_key;

update public.class_groups set name = '1A' where name = '1-1' and year_grade = 'Grade 7'  and not exists (select 1 from public.class_groups c where c.name = '1A');
update public.class_groups set name = '2A' where name = '2-1' and year_grade = 'Grade 8'  and not exists (select 1 from public.class_groups c where c.name = '2A');
update public.class_groups set name = '3A' where name = '3-1' and year_grade = 'Grade 9'  and not exists (select 1 from public.class_groups c where c.name = '3A');
update public.class_groups set name = '4A' where name = '4-1' and year_grade = 'Grade 10' and not exists (select 1 from public.class_groups c where c.name = '4A');
update public.class_groups set name = '5A' where name = '5-1' and year_grade = 'Grade 11' and not exists (select 1 from public.class_groups c where c.name = '5A');

do $$
declare
  cg record;
  fk record;
  in_use boolean;
  n int;
  kept text[] := '{}';
  removed int := 0;
begin
  for cg in
    select id, name from public.class_groups
    where name ~ '^([1-5]-[1-9]|6[AB][1-3])$'
  loop
    in_use := false;
    -- every table with a foreign key to class_groups
    for fk in
      select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = 'public.class_groups'::regclass
    loop
      execute format('select count(*) from %s where %I = $1', fk.tbl, fk.col) into n using cg.id;
      if n > 0 then in_use := true; exit; end if;
    end loop;

    if in_use then
      kept := kept || cg.name;
    else
      delete from public.class_groups where id = cg.id;
      removed := removed + 1;
    end if;
  end loop;

  raise notice 'Removed % unused classes. Kept because they are in use: %', removed, coalesce(array_to_string(kept, ', '), 'none');
end $$;

commit;
