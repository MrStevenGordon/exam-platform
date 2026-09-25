-- Removes the Smart Learning coverage functions (nothing is stored, so nothing is lost).
begin;
drop function if exists public.learning_coverage(text, int);
drop function if exists public.learning_coverage_subjects();
drop function if exists public.learning_coverage_can_see(text);
commit;
