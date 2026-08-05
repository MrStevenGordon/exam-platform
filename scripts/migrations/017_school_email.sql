-- Students log in with a synthetic id# @mhs.smartassess address (see
-- SCHOOL_DOMAIN in school-admin/students/page.tsx and create-user) — that's
-- never been a real inbox. This adds a place to store their actual school
-- domain email (e.g. firstname.lastname@stu.mhs.edu.jm) so the platform can
-- send them real notifications, without touching how they log in.
alter table profiles add column if not exists school_email text;

-- Nulls don't conflict under a unique constraint, so students without one
-- on file (not every row is guaranteed to have it) don't block each other.
create unique index if not exists profiles_school_email_key on profiles (school_email) where school_email is not null;
