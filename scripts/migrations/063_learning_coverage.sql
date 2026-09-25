-- Smart Learning coverage: which topics have been taught to which classes.
--
-- A grid for one subject and grade: every active topic on the school's topic list against every
-- class in that year, showing whether the class has been given a lesson on it and how many
-- students finished. It also counts lessons that are not linked to a topic (they cannot appear
-- in the grid) so a department can see how much of its teaching is not being counted.
--
-- WHO SEES WHAT (enforced here, not in the screen)
--   * the principal team and school admins: every subject and grade
--   * a head of department: only the subjects of their own department
--   * teachers and students: nothing
--
-- ISOLATION
--   Read-only. It reads Smart Learning's tables, the topic list and the class list. The average
--   check score is read from the shared evidence feed (migration 060) only if that exists; without
--   it the score is simply left blank. Nothing is written and nothing in Smart Assess is touched.
--
-- Requires 058 and 059.
-- Roll back with scripts/migrations/rollback/063_learning_coverage_rollback.sql

begin;

-- Which subjects a caller may see coverage for.
create or replace function public.learning_coverage_can_see(p_subject text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_admin() or public.is_principal()
      or (public.is_supervisor() and public.topic_subject_managed_by_hod(p_subject))
$$;
revoke execute on function public.learning_coverage_can_see(text) from public, anon, authenticated;

-- The subject and grade combinations that have topics, limited to what the caller may see.
create or replace function public.learning_coverage_subjects()
returns table (subject text, grade int, topics int)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if not (public.is_admin() or public.is_principal() or public.is_supervisor()) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select t.subject, t.grade, count(*)::int
  from curriculum_topics t
  where t.status = 'active' and public.learning_coverage_can_see(t.subject)
  group by t.subject, t.grade
  order by t.subject, t.grade;
end;
$$;

-- The grid for one subject and grade, as one JSON document:
--   topics   the active topics, in list order
--   classes  every class in that year with its number of students
--   cells    one entry per (topic, class) that has at least one published lesson given to it
--   unlinked_lessons  published lessons for this subject and grade that have no topic
create or replace function public.learning_coverage(p_subject text, p_grade int)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_topics jsonb;
  v_classes jsonb;
  v_cells jsonb;
  v_unlinked int;
  v_check jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if not public.learning_coverage_can_see(p_subject) then raise exception 'Not allowed.' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'unit', t.unit, 'name', t.name) order by t.unit nulls last, t.sort_order, t.name), '[]'::jsonb)
    into v_topics
    from curriculum_topics t where t.subject = p_subject and t.grade = p_grade and t.status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object('id', cg.id, 'name', cg.name, 'students', (select count(*)::int from enrollments e where e.class_group_id = cg.id)) order by cg.name), '[]'::jsonb)
    into v_classes
    from class_groups cg
   where nullif(regexp_replace(cg.year_grade, '\D', '', 'g'), '')::int = p_grade;

  -- Average first-try check score by topic and class, from the evidence feed if it exists.
  if to_regclass('public.student_evidence') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('topic_id', x.topic_id, 'class_group_id', x.class_group_id, 'pct', x.pct)), '[]'::jsonb)
      from (
        select coalesce(m.merged_into, ev.topic_id) as topic_id, e.class_group_id,
               round(avg(ev.score / ev.max_score * 100))::int as pct
          from public.student_evidence ev
          join public.enrollments e on e.student_id = ev.student_id
          left join public.curriculum_topics m on m.id = ev.topic_id
         where ev.source = 'learning_check' and ev.topic_id is not null
         group by 1, 2
      ) x
    $q$ into v_check;
  end if;

  -- One row per (topic, class, lesson): published lessons with a topic, given to a class in this year.
  -- A lesson on a merged topic counts toward the topic it became.
  with pairs as (
    select coalesce(m.merged_into, l.topic_id) as topic_id, a.class_group_id, l.id as lesson_id, a.created_at
      from learning_assignments a
      join learning_lessons l on l.id = a.lesson_id and l.status = 'published' and l.topic_id is not null
      left join curriculum_topics m on m.id = l.topic_id
      join curriculum_topics t on t.id = coalesce(m.merged_into, l.topic_id) and t.subject = p_subject and t.grade = p_grade and t.status = 'active'
      -- Only classes in the year being viewed, so a lesson given to another year never shows up here.
      join class_groups cg on cg.id = a.class_group_id and nullif(regexp_replace(cg.year_grade, '\D', '', 'g'), '')::int = p_grade
  ), agg as (
    select topic_id, class_group_id, count(distinct lesson_id)::int as lessons, max(created_at)::date as last_given
      from pairs group by topic_id, class_group_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'topic_id', g.topic_id, 'class_group_id', g.class_group_id, 'lessons', g.lessons,
           'students', st.n, 'possible', st.n * g.lessons,
           'finished', (select count(*)::int from learning_progress p
                          join enrollments e on e.student_id = p.student_id and e.class_group_id = g.class_group_id
                         where p.completed_at is not null
                           and p.lesson_id in (select x.lesson_id from pairs x where x.topic_id = g.topic_id and x.class_group_id = g.class_group_id)),
           'last_given', g.last_given,
           'check_pct', (select (k ->> 'pct')::int from jsonb_array_elements(v_check) k
                          where (k ->> 'topic_id')::uuid = g.topic_id and (k ->> 'class_group_id')::uuid = g.class_group_id limit 1)
         )), '[]'::jsonb)
    into v_cells
    from agg g
    cross join lateral (select count(*)::int as n from enrollments e where e.class_group_id = g.class_group_id) st;

  select count(distinct l.id)::int into v_unlinked
    from learning_lessons l
    join learning_assignments a on a.lesson_id = l.id
   where l.status = 'published' and l.topic_id is null
     and lower(btrim(l.subject)) = lower(btrim(p_subject)) and l.grade = p_grade;

  return jsonb_build_object('topics', v_topics, 'classes', v_classes, 'cells', v_cells, 'unlinked_lessons', v_unlinked);
end;
$$;

revoke execute on function public.learning_coverage_subjects(), public.learning_coverage(text, int) from public, anon;
grant execute on function public.learning_coverage_subjects(), public.learning_coverage(text, int) to authenticated;

commit;
