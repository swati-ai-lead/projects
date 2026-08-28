-- Run once in the Supabase SQL Editor. This table is accessed only by Vercel
-- server routes using SUPABASE_SERVICE_ROLE_KEY; no browser policies are added.
create table public.gmail_credentials (
  id smallint primary key check (id = 1),
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.gmail_credentials enable row level security;