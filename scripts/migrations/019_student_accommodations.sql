alter table profiles add column if not exists accommodations jsonb not null default '[]'::jsonb;
