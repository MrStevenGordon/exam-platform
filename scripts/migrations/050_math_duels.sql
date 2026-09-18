-- Math Duels (gamification, localhost dev only until approved): two students
-- race the same random set of bank questions and compare scores. Reuses the
-- existing self-mock taking/grading screen for both players -- a duel is
-- really just two self_mocks built from an identical question set, linked
-- together for display.
--
-- self_mocks RLS ("Students manage own self mocks") is strictly
-- student_id = auth.uid(), so neither duelist can see the other's mock or
-- score directly -- by design, same wall that already exists between any
-- two students' self-mock rows. Every duel table and RPC below is built
-- around that wall rather than punching a hole in it: the two tables here
-- carry no scores or answers, and the one function that needs to read both
-- sides' results (list_my_duels) is a narrow SECURITY DEFINER, scoped to
-- duels the caller is actually part of, same pattern as
-- get_bank_question_subjects.

create table public.duels (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  question_count integer not null default 8,
  created_by uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  creator_mock_id uuid references public.self_mocks(id) on delete set null,
  opponent_mock_id uuid references public.self_mocks(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint duels_not_self_challenge check (created_by <> opponent_id)
);

-- The exact question set a duel was built from, so the opponent's mock (built
-- on accept) gets an identical set/order to the creator's, not a fresh random
-- draw. Not read by the client directly -- only by accept_duel().
create table public.duel_questions (
  duel_id uuid not null references public.duels(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  order_index integer not null default 0,
  primary key (duel_id, question_id)
);

create index duels_created_by_idx on public.duels(created_by);
create index duels_opponent_id_idx on public.duels(opponent_id);

alter table public.duels enable row level security;
alter table public.duel_questions enable row level security;

-- Read-only from the client's own row-level view; every write (create,
-- accept, decline) goes through a validated SECURITY DEFINER function below
-- instead of an RLS insert/update policy, so a duel can't be forged or have
-- its state jumped (e.g. straight to "active" without an opponent's mock).
create policy "Duel participants view their duels" on public.duels
  for select using (auth.uid() = created_by or auth.uid() = opponent_id);

create policy "Duel participants view duel questions" on public.duel_questions
  for select using (
    exists (
      select 1 from public.duels
      where duels.id = duel_questions.duel_id
        and (duels.created_by = auth.uid() or duels.opponent_id = auth.uid())
    )
  );

-- Classmate check: any two students sharing at least one class_group via
-- enrollments. Used both to populate "who can I challenge" and to guard
-- create_duel server-side (the client-side list is a convenience, not the
-- security boundary).
create or replace function public.are_classmates(a uuid, b uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from enrollments e1
    join enrollments e2 on e1.class_group_id = e2.class_group_id
    where e1.student_id = a and e2.student_id = b and a <> b
  );
$$;

grant execute on function public.are_classmates(uuid, uuid) to authenticated;

create or replace function public.get_my_classmates()
returns table (student_id uuid, full_name text)
language sql
stable security definer
set search_path to 'public'
as $$
  select distinct p.id, p.full_name
  from enrollments e1
  join enrollments e2 on e1.class_group_id = e2.class_group_id
  join profiles p on p.id = e2.student_id
  where e1.student_id = auth.uid() and e2.student_id <> auth.uid()
  order by p.full_name;
$$;

grant execute on function public.get_my_classmates() to authenticated;

create or replace function public.create_duel(p_opponent_id uuid, p_subject text, p_question_count integer default 8)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_duel_id uuid;
  v_mock_id uuid;
  v_count integer := greatest(1, least(coalesce(p_question_count, 8), 20));
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'student') then
    raise exception 'Only students can start a duel';
  end if;

  if p_opponent_id = auth.uid() then
    raise exception 'You cannot challenge yourself';
  end if;

  if not public.are_classmates(auth.uid(), p_opponent_id) then
    raise exception 'You can only challenge a classmate';
  end if;

  insert into self_mocks (student_id, subject, question_count)
  values (auth.uid(), p_subject, v_count)
  returning id into v_mock_id;

  insert into duels (created_by, opponent_id, subject, question_count, creator_mock_id, status)
  values (auth.uid(), p_opponent_id, p_subject, v_count, v_mock_id, 'pending')
  returning id into v_duel_id;

  insert into self_mock_questions (self_mock_id, question_id, order_index)
  select v_mock_id, picked.id, row_number() over () - 1
  from (
    select q.id
    from questions q
    join draft_exams d on d.id = q.draft_exam_id
    where q.is_bank_question = true and d.subject = p_subject
    order by random()
    limit v_count
  ) picked;

  insert into duel_questions (duel_id, question_id, order_index)
  select v_duel_id, smq.question_id, smq.order_index
  from self_mock_questions smq
  where smq.self_mock_id = v_mock_id;

  if (select count(*) from duel_questions where duel_id = v_duel_id) = 0 then
    raise exception 'No practice questions available for this subject yet';
  end if;

  return v_duel_id;
end;
$$;

grant execute on function public.create_duel(uuid, text, integer) to authenticated;

create or replace function public.accept_duel(p_duel_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_mock_id uuid;
  v_subject text;
  v_count integer;
begin
  select subject, question_count into v_subject, v_count
  from duels
  where id = p_duel_id and opponent_id = auth.uid() and status = 'pending';

  if v_subject is null then
    raise exception 'Duel not found or already responded to';
  end if;

  insert into self_mocks (student_id, subject, question_count)
  values (auth.uid(), v_subject, v_count)
  returning id into v_mock_id;

  insert into self_mock_questions (self_mock_id, question_id, order_index)
  select v_mock_id, dq.question_id, dq.order_index
  from duel_questions dq
  where dq.duel_id = p_duel_id;

  update duels
  set opponent_mock_id = v_mock_id, status = 'active', responded_at = now()
  where id = p_duel_id;

  return v_mock_id;
end;
$$;

grant execute on function public.accept_duel(uuid) to authenticated;

create or replace function public.decline_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update duels
  set status = 'declined', responded_at = now()
  where id = p_duel_id and opponent_id = auth.uid() and status = 'pending';
end;
$$;

grant execute on function public.decline_duel(uuid) to authenticated;

-- The one place either duelist can see both sides' results. Scoped to duels
-- the caller is actually part of (same guard as the row's own SELECT
-- policy), so this is a convenience projection through the self_mocks wall,
-- not a hole in it -- a student still can't look up a stranger's self_mocks
-- by id.
create or replace function public.list_my_duels()
returns table (
  duel_id uuid,
  subject text,
  question_count integer,
  status text,
  created_at timestamptz,
  responded_at timestamptz,
  is_creator boolean,
  creator_id uuid,
  creator_name text,
  creator_mock_id uuid,
  creator_completed_at timestamptz,
  creator_score numeric,
  creator_max numeric,
  opponent_id uuid,
  opponent_name text,
  opponent_mock_id uuid,
  opponent_completed_at timestamptz,
  opponent_score numeric,
  opponent_max numeric
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    d.id, d.subject, d.question_count, d.status, d.created_at, d.responded_at,
    d.created_by = auth.uid(),
    d.created_by, cp.full_name, d.creator_mock_id, cm.completed_at, cm.total_score, cm.max_possible_score,
    d.opponent_id, op.full_name, d.opponent_mock_id, om.completed_at, om.total_score, om.max_possible_score
  from duels d
  join profiles cp on cp.id = d.created_by
  join profiles op on op.id = d.opponent_id
  left join self_mocks cm on cm.id = d.creator_mock_id
  left join self_mocks om on om.id = d.opponent_mock_id
  where d.created_by = auth.uid() or d.opponent_id = auth.uid()
  order by d.created_at desc;
$$;

grant execute on function public.list_my_duels() to authenticated;
