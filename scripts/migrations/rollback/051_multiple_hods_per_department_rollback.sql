-- Restores my_supervised_department() exactly as it was (copied from the live
-- database before 051 was applied).

create or replace function public.my_supervised_department()
returns uuid
language sql stable security definer
set search_path to 'public'
as $$
  select id from departments where head_id = auth.uid();
$$;
