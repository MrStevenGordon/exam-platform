-- The shared topic list: one place that says what "Simple interest, Grade 9,
-- Mathematics" is, so Smart Assess (questions), Smart Learning (lessons) and
-- Smart Play (games) can all point at the same thing.
--
-- Each topic has a stable CODE (e.g. regular-math-g10-algebra). The code never
-- changes when a topic is renamed, and it is what a product living in a
-- separate database (Smart Play) uses to refer to a topic, since it cannot
-- hold a foreign key into this one.
--
-- WHO CAN DO WHAT (enforced here):
--   everyone signed in   read topics
--   school admin         add / edit / archive / merge anything
--   HOD                  the same, for the subjects in their own department
--   teacher              PROPOSE a topic for a subject they teach (usable straight
--                        away, flagged for the HOD to approve, rename or merge)
--
-- Additive: one new table and one nullable column on questions and lesson_plans.
-- The existing free-text questions.topic stays and keeps working; topic_id is
-- the new, cleaner link. Existing question topics are copied into the list.
--
-- Roll back with scripts/migrations/rollback/058_curriculum_topics_rollback.sql

begin;

create table public.curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  subject text not null check (btrim(subject) <> ''),
  grade int not null check (grade between 7 and 13),
  unit text,
  name text not null check (btrim(name) <> ''),
  sort_order int not null default 0,
  status text not null default 'active' check (status in ('active', 'proposed', 'archived')),
  merged_into uuid references public.curriculum_topics(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live topic per subject, grade and name (case and spacing ignored).
-- Archived ones do not count, so a retired name can be reused.
create unique index curriculum_topics_live_name
  on public.curriculum_topics (lower(btrim(subject)), grade, lower(btrim(name)))
  where status <> 'archived';
create index curriculum_topics_lookup on public.curriculum_topics (subject, grade) where status <> 'archived';

create or replace function public.topic_slug(p text)
returns text language sql immutable
as $$ select trim(both '-' from regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g')) $$;

-- Builds the code on insert, and never lets it change afterwards.
create or replace function public.trg_curriculum_topic_code()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if tg_op = 'UPDATE' then
    new.code := old.code;
    new.updated_at := now();
    return new;
  end if;
  base := public.topic_slug(new.subject) || '-g' || new.grade || '-' || public.topic_slug(new.name);
  candidate := base;
  while exists (select 1 from curriculum_topics where code = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.code := candidate;
  return new;
end;
$$;

create trigger curriculum_topics_code before insert or update on public.curriculum_topics
  for each row execute function public.trg_curriculum_topic_code();

alter table public.questions add column if not exists topic_id uuid references public.curriculum_topics(id) on delete set null;
alter table public.lesson_plans add column if not exists topic_id uuid references public.curriculum_topics(id) on delete set null;
create index if not exists questions_topic_id_idx on public.questions (topic_id) where topic_id is not null;
create index if not exists lesson_plans_topic_id_idx on public.lesson_plans (topic_id) where topic_id is not null;

-- ---- permissions ----------------------------------------------------------------

create or replace function public.topic_subject_managed_by_hod(p_subject text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from department_subjects ds
    where ds.department_id = (select my_supervised_department()) and ds.subject = p_subject
  )
$$;

create or replace function public.topic_subject_taught_by_me(p_subject text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from teacher_subjects ts where ts.teacher_id = auth.uid() and ts.subject = p_subject)
$$;

alter table public.curriculum_topics enable row level security;

create policy "Signed-in users read topics" on public.curriculum_topics
  for select using (auth.uid() is not null);
create policy "Admins manage topics" on public.curriculum_topics
  for all using (public.is_admin()) with check (public.is_admin());
create policy "HODs manage their department's topics" on public.curriculum_topics
  for all using (public.topic_subject_managed_by_hod(subject)) with check (public.topic_subject_managed_by_hod(subject));
create policy "Teachers propose topics for subjects they teach" on public.curriculum_topics
  for insert with check (
    status = 'proposed' and created_by = auth.uid() and merged_into is null
    and public.topic_subject_taught_by_me(subject)
  );

-- ---- merging duplicates -------------------------------------------------------------

-- Folds one topic into another: everything that pointed at the first now points at
-- the second, and the first is archived (remembering where it went). Runs with
-- elevated rights because it must also re-point other teachers' questions and lesson
-- plans; it only does that for a subject the caller manages.
create or replace function public.merge_topics(p_from uuid, p_into uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a curriculum_topics;
  b curriculum_topics;
  nq int;
  nl int;
begin
  select * into a from curriculum_topics where id = p_from;
  select * into b from curriculum_topics where id = p_into;
  if a.id is null or b.id is null then raise exception 'Topic not found.' using errcode = 'P0001'; end if;
  if a.id = b.id then raise exception 'Choose two different topics.' using errcode = 'P0001'; end if;
  if a.subject <> b.subject or a.grade <> b.grade then
    raise exception 'Topics can only be merged within the same subject and grade.' using errcode = 'P0001';
  end if;
  if b.status = 'archived' then raise exception 'Merge into a topic that is still in use.' using errcode = 'P0001'; end if;
  if not (public.is_admin() or public.topic_subject_managed_by_hod(a.subject)) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  update questions set topic_id = b.id, topic = b.name where topic_id = a.id;
  get diagnostics nq = row_count;
  update lesson_plans set topic_id = b.id where topic_id = a.id;
  get diagnostics nl = row_count;
  update curriculum_topics set status = 'archived', merged_into = b.id where id = a.id;
  return jsonb_build_object('questions', nq, 'lesson_plans', nl);
end;
$$;

-- How many questions and lesson plans use each topic (counts only, no content),
-- so people can see what an archive or merge will affect.
create or replace function public.topic_usage()
returns table (topic_id uuid, questions int, lesson_plans int)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.is_staff() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
  select t.id,
         (select count(*)::int from questions q where q.topic_id = t.id),
         (select count(*)::int from lesson_plans lp where lp.topic_id = t.id)
  from curriculum_topics t;
end;
$$;

revoke execute on function public.merge_topics(uuid, uuid), public.topic_usage() from public, anon;
grant execute on function public.merge_topics(uuid, uuid), public.topic_usage() to authenticated;

-- ---- start the list from what teachers already use ---------------------------------------
-- Only question topics that have a subject and a grade (from their exam). Lesson
-- plan "topics" are mostly lesson titles, so they are not copied.

insert into public.curriculum_topics (subject, grade, name, status)
select distinct d.subject, d.target_grade, btrim(q.topic), 'active'
from public.questions q
join public.draft_exams d on d.id = q.draft_exam_id
where q.topic is not null and btrim(q.topic) <> ''
  and d.subject is not null and btrim(d.subject) <> ''
  and d.target_grade between 7 and 13
order by 1, 2, 3
on conflict do nothing;

update public.questions q
   set topic_id = t.id
  from public.draft_exams d, public.curriculum_topics t
 where d.id = q.draft_exam_id
   and q.topic is not null
   and lower(btrim(q.topic)) = lower(t.name)
   and lower(btrim(d.subject)) = lower(btrim(t.subject))
   and d.target_grade = t.grade
   and t.status <> 'archived'
   and q.topic_id is null;

commit;
