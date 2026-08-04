create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

-- Fixed-window counter. Atomic via the upsert's row-level lock, so
-- concurrent requests for the same key can't race past the limit.
-- Returns true if the request is allowed, false if it should be rejected.
create or replace function check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_count int;
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update set
    count = case
      when rate_limits.window_start < v_now - (p_window_seconds || ' seconds')::interval
        then 1
      else rate_limits.count + 1
    end,
    window_start = case
      when rate_limits.window_start < v_now - (p_window_seconds || ' seconds')::interval
        then v_now
      else rate_limits.window_start
    end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- No RLS needed: this table is never queried directly by client code, only
-- via the SECURITY DEFINER function above, called from server-side API
-- routes using the service-role key.
alter table rate_limits enable row level security;
