-- Smart Assess Play: teacher-managed game questions.
-- status controls whether students can ever see a question: only 'approved'
-- questions are drawn into Topic Mastery, Math Duels and live games. Questions
-- are archived, never deleted, because deleting one would cascade away every
-- student's recorded answer to it.
--
-- Existing rows (the starter set and bank imports) stay 'approved'. created_by
-- is null for those, which the teacher screen labels as the starter set.

alter table play_questions
  add column if not exists status text not null default 'approved',
  add column if not exists created_by uuid references play_accounts(id) on delete set null,
  add column if not exists updated_by uuid references play_accounts(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'play_questions_status_check') then
    alter table play_questions add constraint play_questions_status_check check (status in ('draft', 'approved', 'archived'));
  end if;
end $$;

create index if not exists play_questions_status_idx on play_questions (status, subject, topic);
