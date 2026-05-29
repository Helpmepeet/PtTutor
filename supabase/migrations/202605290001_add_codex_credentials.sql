-- Per-user ChatGPT/Codex subscription OAuth tokens. Each app user links their
-- own OpenAI account; their LLM calls bill to their own subscription. One row
-- per user. Only the service-role key (server) reads/writes this table; RLS is
-- enabled with no policies so it is never reachable by client/anon sessions.
create table if not exists public.codex_credentials (
  user_id uuid primary key references public.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  account_id text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.codex_credentials enable row level security;
