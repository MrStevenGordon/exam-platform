-- Replaces the desktop app's license-key activation screen with
-- login-time enforcement. Since every school already runs on its own
-- separate database, there's no need to distinguish accounts by a school
-- code at all — every account in a given school's database already
-- belongs to that school. If the subscription tracked centrally (in
-- school_subscriptions, on the platform owner's database) lapses, the
-- owner pushes that status into the school's own school_settings row via
-- a one-time connection, and login blocks for every account there until
-- it's renewed.
--
-- Defaults to active/unrestricted so schools that predate this (Manchester
-- High) don't lose access until the owner explicitly configures it.

alter table public.school_settings add column if not exists subscription_active boolean not null default true;
alter table public.school_settings add column if not exists subscription_expires_at timestamp with time zone;
