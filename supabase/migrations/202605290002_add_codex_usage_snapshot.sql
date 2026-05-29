-- Latest rate-limit / usage snapshot per user, captured from the Codex backend
-- response headers (primary ≈5h and secondary ≈weekly windows). One snapshot
-- per user (the most recent); stored on the existing credentials row.
alter table public.codex_credentials
  add column if not exists usage_snapshot jsonb,
  add column if not exists usage_captured_at timestamptz;
