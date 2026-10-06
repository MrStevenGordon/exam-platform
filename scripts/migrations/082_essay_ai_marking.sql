-- 082: AI-suggested essay marking (Smart Assess), the suggestions table.
--
-- Holds what the AI suggested for an essay answer, and afterwards the marks the teacher finally gave, so we can see how often teachers
-- change a suggestion. A suggestion is NEVER a mark: nothing here is read by scoring, results or release.
--
-- WHY A TABLE, NOT A COLUMN ON responses: students can read their own response rows, so a column there would show them the AI's
-- verdict on their own essay. This table is readable only by staff who can already read that response, and only the server writes suggestions.
--
-- WHO CAN DO WHAT
--   read    staff (teacher, head of department, admin) who can already read the response (the same row-level rules as responses)
--   write   suggestions: the server only (service role). Teachers may only fill in the final marks columns, on rows they can see.
--   students and everyone else: nothing
--
-- Needs 080/081 not at all; independent of them. Adds one table. Nothing existing changes.
-- Roll back with scripts/migrations/rollback/082_essay_ai_marking_rollback.sql

begin;

create table public.essay_ai_marking (
  response_id uuid primary key references public.responses(id) on delete cascade,
  suggestion jsonb not null,
  model text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- filled in when the teacher saves their own marks
  final_marks jsonb,
  final_total numeric,
  finalized_by uuid references public.profiles(id) on delete set null,
  finalized_at timestamptz,
  constraint essay_ai_marking_suggestion_shape check (jsonb_typeof(suggestion) = 'object' and suggestion ? 'points'),
  constraint essay_ai_marking_final_marks_shape check (final_marks is null or jsonb_typeof(final_marks) = 'array')
);

create index essay_ai_marking_created_at_idx on public.essay_ai_marking (created_at);

alter table public.essay_ai_marking enable row level security;

-- Staff who can read the response can read its suggestion. The subquery runs under the caller's own row-level rules, so a
-- teacher sees exactly the responses they already could.
create policy "Staff read suggestions for responses they can read" on public.essay_ai_marking
  for select using (public.is_staff() and exists (select 1 from public.responses r where r.id = essay_ai_marking.response_id));

-- Staff may record their final marks on a suggestion they can read (and only those columns, see the grants below).
create policy "Staff record final marks on suggestions they can read" on public.essay_ai_marking
  for update using (public.is_staff() and exists (select 1 from public.responses r where r.id = essay_ai_marking.response_id))
  with check (public.is_staff() and exists (select 1 from public.responses r where r.id = essay_ai_marking.response_id));

revoke all on public.essay_ai_marking from anon, authenticated;
grant select on public.essay_ai_marking to authenticated;
grant update (final_marks, final_total, finalized_by, finalized_at) on public.essay_ai_marking to authenticated;

commit;

select 'Migration 082 applied' as result;
