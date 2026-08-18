-- Live leaderboard for in-room demo-exam events (e.g. the OCBN meetup).
-- Unlike waitlist_signups/investor_inquiries, this table is publicly
-- readable too -- the leaderboard itself is meant to be shown on the demo
-- page to anyone taking it, not just system admins.

create table public.ocbn_demo_leaderboard (
  id uuid primary key default gen_random_uuid(),
  event_key text not null default 'ocbn-2026',
  first_name text not null,
  score integer not null check (score >= 0),
  total_questions integer not null check (total_questions > 0 and score <= total_questions),
  time_seconds integer not null check (time_seconds >= 0),
  submitted_at timestamp with time zone default now() not null
);

create index ocbn_demo_leaderboard_ranking_idx
  on public.ocbn_demo_leaderboard (event_key, score desc, time_seconds asc);

alter table public.ocbn_demo_leaderboard enable row level security;

create policy "anyone can submit a leaderboard entry" on public.ocbn_demo_leaderboard
  for insert to authenticated, anon with check (true);

create policy "anyone can view the leaderboard" on public.ocbn_demo_leaderboard
  for select to authenticated, anon using (true);
