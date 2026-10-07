-- Puts the lesson plans rule back to "the row is yours" (which also lets a student write their own plans).
begin;
drop policy if exists "Teachers manage their own lesson plans" on public.lesson_plans;
create policy "Teachers manage their own lesson plans" on public.lesson_plans for all
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
commit;
select 'Migration 094 rolled back' as result;
