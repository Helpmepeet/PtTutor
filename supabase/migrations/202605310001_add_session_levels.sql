alter table public.sessions
  add column if not exists actor_level text not null default 'standard',
  add column if not exists reviewer_feedback_mode text not null default 'standard';
