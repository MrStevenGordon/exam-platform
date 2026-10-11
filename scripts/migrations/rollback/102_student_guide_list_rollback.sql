-- Rolls back 102: the lesson list no longer shows which lessons have a study guide. Guides themselves are untouched.
drop function if exists public.learning_student_guides();
