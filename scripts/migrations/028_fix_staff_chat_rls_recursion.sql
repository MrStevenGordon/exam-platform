-- 027's "users view participant rows in their conversations" policy on
-- conversation_participants queried conversation_participants from within
-- its own USING clause, which Postgres correctly rejects as infinite
-- recursion (42P17) -- and since conversations/messages' policies both
-- check conversation_participants, the failure cascaded to those too.
--
-- Same fix already used elsewhere in this schema (is_teacher_of_class_student,
-- is_supervisor_of_student, etc.): a SECURITY DEFINER helper bypasses RLS
-- internally, so referencing it from a policy doesn't re-trigger the policy
-- it's being evaluated for.

create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = conv_id and user_id = auth.uid()
  );
$$;

drop policy "users view participant rows in their conversations" on public.conversation_participants;

create policy "users view participant rows in their conversations" on public.conversation_participants
  for select using (public.is_conversation_participant(conversation_id));
