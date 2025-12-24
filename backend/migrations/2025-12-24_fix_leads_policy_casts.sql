-- 2025-12-24: Fix leads RLS policies to cast auth.uid() to uuid
-- Replace existing leads policies that compare auth.uid() (text) to uuid columns.

begin;

alter table if exists public.leads enable row level security;

drop policy if exists "leads viewable by owner" on public.leads;
create policy "leads viewable by owner" on public.leads
  for select using (user_id = auth.uid()::uuid);

drop policy if exists "leads insertable by owner" on public.leads;
create policy "leads insertable by owner" on public.leads
  for insert with check (user_id = auth.uid()::uuid);

drop policy if exists "leads updatable by owner" on public.leads;
create policy "leads updatable by owner" on public.leads
  for update using (user_id = auth.uid()::uuid);

drop policy if exists "leads deletable by owner" on public.leads;
create policy "leads deletable by owner" on public.leads
  for delete using (user_id = auth.uid()::uuid);

commit;
