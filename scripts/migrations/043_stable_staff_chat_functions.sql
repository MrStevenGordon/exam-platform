-- Follow-up to 040_stable_rls_functions.sql: is_staff() and
-- is_conversation_participant() (added later, in 027/028_staff_chat) were
-- missed by that fix. Same bug, same cause -- both are pure reads left
-- VOLATILE by default, referenced from the messages/conversations/
-- conversation_participants RLS policies the sidebar's unread badge and
-- StaffMessages depend on. Marking them STABLE is the same safe,
-- behavior-preserving planner hint as 040.

alter function public.is_staff() stable;
alter function public.is_conversation_participant(uuid) stable;
