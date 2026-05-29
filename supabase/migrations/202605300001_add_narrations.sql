alter table public.messages
  add column if not exists narrations jsonb;
