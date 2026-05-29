create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scenario_id text not null,
  title text not null,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  actor_provider_thread_id text,
  reviewer_provider_thread_id text,
  teacher_provider_thread_id text
);

create table if not exists public.custom_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text not null,
  category text not null check (category in ('daily', 'work', 'social')),
  icon text not null default '💬',
  feedback_mode text not null default 'standard' check (feedback_mode in ('light', 'standard', 'strict')),
  starter text not null check (starter in ('actor', 'user')),
  actor_role text not null,
  actor_setting text not null,
  actor_personality text not null,
  scenario_context text not null,
  user_role text not null,
  starter_instruction text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user', 'actor')),
  content text not null,
  created_at timestamptz not null default now(),
  client_message_id text,
  parent_user_message_id uuid references public.messages(id) on delete set null,
  reviewer_output jsonb,
  actor_status text check (actor_status in ('pending', 'succeeded', 'failed', 'skipped')),
  reviewer_status text check (reviewer_status in ('pending', 'succeeded', 'failed')),
  actor_error text,
  reviewer_error text,
  actor_retry_count integer not null default 0,
  reviewer_retry_count integer not null default 0,
  constraint user_message_client_id_unique unique (session_id, client_message_id)
);

create table if not exists public.teacher_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user', 'teacher')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_recent_idx
  on public.sessions(user_id, last_message_at desc);

create index if not exists custom_scenarios_user_recent_idx
  on public.custom_scenarios(user_id, created_at desc);

create index if not exists messages_session_created_idx
  on public.messages(session_id, created_at asc);

create index if not exists teacher_messages_session_created_idx
  on public.teacher_messages(session_id, created_at asc);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.custom_scenarios enable row level security;
alter table public.messages enable row level security;
alter table public.teacher_messages enable row level security;

create policy "Users can read their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can read own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);

create policy "Users can read own custom scenarios"
  on public.custom_scenarios for select
  using (auth.uid() = user_id);

create policy "Users can insert own custom scenarios"
  on public.custom_scenarios for insert
  with check (auth.uid() = user_id);

create policy "Users can read own messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.sessions
      where sessions.id = messages.session_id
      and sessions.user_id = auth.uid()
    )
  );

create policy "Users can read own teacher messages"
  on public.teacher_messages for select
  using (
    exists (
      select 1 from public.sessions
      where sessions.id = teacher_messages.session_id
      and sessions.user_id = auth.uid()
    )
  );
