-- 2025-12-29: Track user sessions (device fingerprint + UA + last_seen)

begin;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  user_agent text null,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  unique (user_id, fingerprint)
);

create index if not exists idx_user_sessions_user_last_seen on public.user_sessions (user_id, last_seen desc);

-- RLS
alter table public.user_sessions enable row level security;
drop policy if exists "user_sessions viewable by owner" on public.user_sessions;
create policy "user_sessions viewable by owner" on public.user_sessions
  for select using (user_id = auth.uid()::uuid);

drop policy if exists "user_sessions updatable by owner" on public.user_sessions;
create policy "user_sessions updatable by owner" on public.user_sessions
  for update using (user_id = auth.uid()::uuid);

drop policy if exists "user_sessions insertable by owner" on public.user_sessions;
create policy "user_sessions insertable by owner" on public.user_sessions
  for insert with check (user_id = auth.uid()::uuid);

drop policy if exists "user_sessions deletable by owner" on public.user_sessions;
create policy "user_sessions deletable by owner" on public.user_sessions
  for delete using (user_id = auth.uid()::uuid);

commit;
