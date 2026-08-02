-- Fixes a live bug: the student-facing exam start pages
-- (student/exam/[id] for final exams, student/direct-exam/[id] for
-- direct-published ones) already query and check available_from/
-- available_until, but neither column ever existed on final_exams or
-- draft_exams — every "Start Exam" click was failing with "column
-- final_exams.available_from does not exist". No teacher-side UI sets
-- these fields anywhere, so they're always null today, matching the
-- current (unrestricted) behavior exactly — this only fixes the crash.

alter table public.final_exams add column if not exists available_from timestamp with time zone;
alter table public.final_exams add column if not exists available_until timestamp with time zone;

alter table public.draft_exams add column if not exists available_from timestamp with time zone;
alter table public.draft_exams add column if not exists available_until timestamp with time zone;
