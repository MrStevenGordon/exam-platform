-- Smart Assess Play: badges and milestones.
-- The badge catalog lives in code (src/lib/playBadges.ts); this table only
-- records that a student earned one, so a badge stays earned and a student can
-- be told about it once. Every badge is a fact about history that can only
-- become more true (a best streak never shrinks, XP never falls), so awarding
-- is idempotent and safe to run whenever a student looks.

create table if not exists play_badges_earned (
  account_id uuid not null references play_accounts(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  -- Null until the student has opened their badges, which drives the "new" marker.
  seen_at timestamptz,
  primary key (account_id, badge_key)
);
