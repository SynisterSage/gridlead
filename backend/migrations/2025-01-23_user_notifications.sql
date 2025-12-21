-- 2025-01-23: notification preferences table

create table if not exists public.user_notifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  leads boolean default true,
  replies boolean default true,
  weekly boolean default false,
  browser boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_notifications enable row level security;

drop policy if exists "user_notifications viewable by owner" on public.user_notifications;
create policy "user_notifications viewable by owner" on public.user_notifications
  for select using (auth.uid() = user_id);

drop policy if exists "user_notifications insertable by owner" on public.user_notifications;
create policy "user_notifications insertable by owner" on public.user_notifications
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_notifications updatable by owner" on public.user_notifications;
create policy "user_notifications updatable by owner" on public.user_notifications
  for update using (auth.uid() = user_id);

create or replace function public.handle_user_notifications_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_notifications_updated_at on public.user_notifications;
create trigger trg_user_notifications_updated_at
before update on public.user_notifications
for each row execute procedure public.handle_user_notifications_updated_at();
