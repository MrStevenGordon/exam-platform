-- Chat widget conversation logging. No RLS policies are defined here
-- deliberately (RLS defaults to deny-all once enabled) — nothing reads
-- this through the normal client yet, only the service-role API route
-- writes to it. A future admin-facing review UI would add its own
-- explicit, scoped SELECT policy rather than opening this up broadly.

create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  surface text not null check (surface in ('public', 'app')),
  role text,
  started_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_id_idx on chat_messages (conversation_id);

alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;
