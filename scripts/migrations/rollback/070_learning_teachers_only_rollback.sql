-- Restores who may own lessons exactly as it was before 070 (any staff role).
begin;
drop policy if exists "Teachers and HODs manage their own lessons" on public.learning_lessons;
create policy "Staff manage their own lessons" on public.learning_lessons
  for all
  using (teacher_id = auth.uid() and public.is_staff())
  with check (teacher_id = auth.uid() and public.is_staff());
create or replace function public.learning_owns_lesson(p_lesson_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$ select exists (select 1 from learning_lessons l where l.id = p_lesson_id and l.teacher_id = auth.uid()) $$;
commit;
