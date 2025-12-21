-- 2025-01-21: Gmail account + credentials tables

create table if not exists public.gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  email text not null,
  status text default 'pending', -- pending | connected | error | revoked
  scopes text[] default array[]::text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.gmail_accounts enable row level security;

create policy "gmail accounts viewable by owner" on public.gmail_accounts
  for select using (auth.uid() = user_id);

create policy "gmail accounts insertable by owner" on public.gmail_accounts
  for insert with check (auth.uid() = user_id);

create policy "gmail accounts updatable by owner" on public.gmail_accounts
  for update using (auth.uid() = user_id);

create or replace function public.handle_gmail_accounts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gmail_accounts_updated_at on public.gmail_accounts;
create trigger trg_gmail_accounts_updated_at
before update on public.gmail_accounts
for each row execute procedure public.handle_gmail_accounts_updated_at();

-- Secure credentials table (no client RLS access; use service role / Edge Functions)
create schema if not exists private;

create table if not exists private.gmail_credentials (
  id uuid primary key references public.gmail_accounts(id) on delete cascade,
  refresh_token text,
  access_token text,
  expiry timestamptz,
  provider text default 'google'
);

-- optional index for lookups
create index if not exists idx_gmail_accounts_user on public.gmail_accounts(user_id);
