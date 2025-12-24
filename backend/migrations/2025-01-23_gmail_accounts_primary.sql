-- 2025-01-23: Gmail accounts delete policy + primary flag

alter table if exists public.gmail_accounts
  add column if not exists is_primary boolean default false;

-- Ensure only owners can delete their gmail accounts
drop policy if exists "gmail accounts deletable by owner" on public.gmail_accounts;
create policy "gmail accounts deletable by owner" on public.gmail_accounts
  for delete using (auth.uid()::uuid = user_id);

-- Enforce a single primary per user
drop index if exists idx_gmail_accounts_primary_unique;
create unique index idx_gmail_accounts_primary_unique
  on public.gmail_accounts(user_id)
  where is_primary;

-- Backfill: if a user has accounts but no primary, set the oldest as primary
update public.gmail_accounts ga
set is_primary = true
from (
  select id
  from (
    select id, user_id,
           row_number() over (partition by user_id order by created_at) as rn
    from public.gmail_accounts
  ) ranked
  where rn = 1
) first_accounts
where ga.id = first_accounts.id
  and not exists (
    select 1 from public.gmail_accounts g2
    where g2.user_id = ga.user_id and g2.is_primary = true
  );
