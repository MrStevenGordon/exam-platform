-- Total unread staff-message count for the sidebar "Messages" nav badge.
-- Sums unread messages across every conversation the caller belongs to,
-- including the staff_group conversation before they have a
-- conversation_participants row for it (treated as never read).

create or replace function public.get_unread_message_count()
returns integer
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(sum(unread), 0)::integer
  from (
    select count(*) as unread
    from messages m
    join conversations c on c.id = m.conversation_id
    left join conversation_participants cp
      on cp.conversation_id = m.conversation_id and cp.user_id = auth.uid()
    where m.sender_id != auth.uid()
      and m.created_at > coalesce(cp.last_read_at, '-infinity'::timestamptz)
      and (
        (c.type = 'staff_group' and public.is_staff())
        or (c.type = 'direct' and cp.user_id is not null)
      )
  ) counts;
$$;
