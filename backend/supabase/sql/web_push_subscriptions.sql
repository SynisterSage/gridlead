create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique(endpoint),
  unique(user_id, endpoint)
);

create index if not exists idx_web_push_subscriptions_user on public.web_push_subscriptions(user_id);
