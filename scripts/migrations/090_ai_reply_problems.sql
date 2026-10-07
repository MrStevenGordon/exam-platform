-- 090: a small record of AI replies the app could not read (Smart Assess school tools).
--
-- WHY: when the AI's answer cannot be read (cut off, or garbled) the teacher sees "try again", and until now the only trace was in
-- the hosting provider's logs, which a free plan barely keeps. This keeps the reason in the school's own database so it can be read
-- later with one query.
--
-- WHAT: one table, written only by the server. It holds the feature, why the reply failed, how it stopped, how long it was, and the first
-- and last 300 characters (so the cause can be seen). No student data is sent to these AI features; the text is a teacher's lesson plan,
-- question or exam. Nobody signed in can read or write the table from the app; read it in the Supabase SQL editor:
--   select created_at, feature, reason, stop_reason, reply_length, attempt, head, tail from ai_reply_problems order by created_at desc limit 20;
-- Rows older than 60 days are removed by the app as it writes new ones.
-- Roll back with scripts/migrations/rollback/090_ai_reply_problems_rollback.sql

begin;

create table public.ai_reply_problems (
  id uuid primary key default gen_random_uuid(),
  feature text not null check (length(feature) <= 60),
  reason text not null check (length(reason) <= 40),
  stop_reason text check (stop_reason is null or length(stop_reason) <= 40),
  reply_length integer check (reply_length is null or reply_length >= 0),
  attempt integer,
  head text check (head is null or length(head) <= 400),
  tail text check (tail is null or length(tail) <= 400),
  created_at timestamptz not null default now()
);
create index ai_reply_problems_created on public.ai_reply_problems (created_at desc);

alter table public.ai_reply_problems enable row level security;
revoke all on public.ai_reply_problems from anon, authenticated, public;
-- no policies: only the server (service role) can read or write

commit;

select 'Migration 090 applied' as result;
