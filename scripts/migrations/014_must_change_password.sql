-- Closes a real gap: every student/staff account created via create-user
-- gets a shared, hardcoded default password (Student.Test / Staff.Default1).
-- Login redirects to /change-password on a default-password login, but
-- that was only a one-time UI suggestion — nothing stopped a user from
-- navigating straight to their portal instead and using the app
-- indefinitely on the still-shared default password. This flag makes the
-- requirement a persisted, server-enforced state instead, checked in
-- verifyPortalRole() (src/lib/verifyPortalRole.ts) on every portal page
-- load rather than only at the moment of login.
alter table profiles add column if not exists must_change_password boolean not null default false;
