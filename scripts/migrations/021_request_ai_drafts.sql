-- Adds an AI-generated internal review draft to school/org requests, plus
-- the staff-notification gap this piggybacks on fixing (see submit routes).
-- Additive only, no existing columns touched.

alter table public.school_requests
  add column if not exists ai_draft text,
  add column if not exists ai_draft_generated_at timestamp with time zone;

alter table public.org_requests
  add column if not exists ai_draft text,
  add column if not exists ai_draft_generated_at timestamp with time zone;
