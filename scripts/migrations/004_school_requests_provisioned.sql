-- Adds the "provisioned" lifecycle stage (portal built, credentials sent).
-- No password is ever stored here — it only ever passes through the
-- credentials email at send time.

alter table public.school_requests drop constraint school_requests_status_check;

alter table public.school_requests add constraint school_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'provisioned'));

alter table public.school_requests add column if not exists provisioned_at timestamp with time zone;
alter table public.school_requests add column if not exists portal_url text;
