-- 2025-12-24: Fix RLS policies for user_notifications and leads to cast auth.uid() to uuid
-- This migration updates the RLS policies to use auth.uid()::uuid
-- so comparisons to UUID columns don't fail with operator errors.

begin;

-- user_notifications
alter table if exists public.user_notifications enable row level security;

drop policy if exists "user_notifications viewable by owner" on public.user_notifications;
create policy "user_notifications viewable by owner" on public.user_notifications
  for select using (auth.uid()::uuid = user_id);

drop policy if exists "user_notifications insertable by owner" on public.user_notifications;
create policy "user_notifications insertable by owner" on public.user_notifications
  for insert with check (auth.uid()::uuid = user_id);

drop policy if exists "user_notifications updatable by owner" on public.user_notifications;
create policy "user_notifications updatable by owner" on public.user_notifications
  for update using (auth.uid()::uuid = user_id);

-- leads
alter table if exists public.leads enable row level security;

drop policy if exists "leads viewable by owner" on public.leads;
create policy "leads viewable by owner" on public.leads
  for select using (auth.uid()::uuid = user_id);

drop policy if exists "leads insertable by owner" on public.leads;
create policy "leads insertable by owner" on public.leads
  for insert with check (auth.uid()::uuid = user_id);

drop policy if exists "leads updatable by owner" on public.leads;
create policy "leads updatable by owner" on public.leads
  for update using (auth.uid()::uuid = user_id);

drop policy if exists "leads deletable by owner" on public.leads;
create policy "leads deletable by owner" on public.leads
  for delete using (auth.uid()::uuid = user_id);

commit;
