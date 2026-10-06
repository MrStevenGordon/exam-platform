-- 085: lessons for a student's weak topics (the Assess -> Learning catch-up loop).
--
-- One secured function, my_topic_lessons(): the Smart Learning lessons a signed-in STUDENT can open right now that are tagged with
-- a topic, so their "My topics" page can say "lessons on this topic" next to a topic they need to work on. It only matches
-- lessons by topic id; the app does the matching (src/lib/studentTopicsPure.ts).
--
-- WHAT IT RETURNS: for each lesson the student may open today (published, given to one of the student's classes, not past its
-- due date unless kept open): its id, title, subject, topic (a merged topic counts as the topic it became) and whether the student
-- has finished it. Nothing about other students, nothing about marks, and no lesson content beyond its title.
--
-- Teachers, principals, inactive accounts and signed-out callers are refused. Lessons with no topic are not returned.
-- Needs Smart Learning (059) and lesson topics (061). Adds functions only; nothing existing changes and nothing is written.
-- Roll back with scripts/migrations/rollback/085_topic_lessons_rollback.sql

begin;

do $$
begin
  if to_regclass('public.learning_lessons') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_lessons' and column_name = 'topic_id') then
    raise exception 'Apply migrations 059 and 061 (Smart Learning and lesson topics) first.';
  end if;
end $$;

-- Tiny probe so the app can hide the lesson links until this migration is installed.
create or replace function public.topic_lessons_ready()
returns boolean
language sql immutable
as $$ select true $$;

create or replace function public.my_topic_lessons()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if not found or coalesce(me.is_active, true) = false or me.role <> 'student' then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'subject', x.subject, 'topic_id', x.topic_id, 'done', x.done)
                     order by x.done, x.title)
      from (
        select distinct l.id, l.title, l.subject, coalesce(raw.merged_into, l.topic_id) as topic_id,
               exists (select 1 from learning_progress p where p.lesson_id = l.id and p.student_id = me.id and p.completed_at is not null) as done
          from learning_lessons l
          left join curriculum_topics raw on raw.id = l.topic_id
         where l.topic_id is not null
           and l.status = 'published'
           and public.learning_student_access(l.id) = 'open'
         limit 300
      ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.my_topic_lessons() from public, anon;
grant execute on function public.my_topic_lessons() to authenticated;
grant execute on function public.topic_lessons_ready() to authenticated;

commit;
select 'Migration 085 applied' as result;
