-- Unpublished lesson plans are private to their author.
--
-- 036 let every supervisor/admin read ALL lesson plans (for oversight), which
-- meant an HOD opening Lesson Plans could see teachers' unpublished drafts.
-- Nothing in the app uses that oversight read, so it is removed: a plan is
-- visible to its author only, until they choose "Publish to Library" (the
-- shared library is a separate store and is unaffected).
--
-- Roll back with scripts/migrations/rollback/054_lesson_plans_private_to_author_rollback.sql

drop policy if exists "Supervisors and admins view all lesson plans" on public.lesson_plans;
