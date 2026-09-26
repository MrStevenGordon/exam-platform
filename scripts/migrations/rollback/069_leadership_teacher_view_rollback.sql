-- Rolls back 069 (functions only; nothing else was changed).
begin;
drop function if exists public.leadership_teacher_marking(uuid);
drop function if exists public.leadership_teacher_assessments(uuid);
drop function if exists public.leadership_teacher_overview(uuid);
drop function if exists public.leadership_teachers();
drop function if exists public.leadership_marking_sessions(uuid);
drop function if exists public.leadership_can_view_teacher(uuid);
commit;
