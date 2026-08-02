-- Per-school feature configuration. Toggles which of the app's existing
-- capabilities a school actually uses (review hierarchy stages, exam
-- categories) — not a workflow builder, just an on/off switch on
-- functionality that already exists. Lives on school_settings since that's
-- already the one-row-per-deployment config table for this school's own
-- separate database.
--
-- NULL means "not configured yet" — every read of this column must
-- default to the full feature set (matching current behavior) so schools
-- that predate this column, like Manchester High, don't lose anything
-- until explicitly configured.

alter table public.school_settings add column if not exists enabled_features jsonb;
