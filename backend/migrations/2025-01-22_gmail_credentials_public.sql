-- 2025-01-22: Public gmail_credentials table for REST access
create schema if not exists public;
create table if not exists public.gmail_credentials (
  id uuid primary key references public.gmail_accounts(id) on delete cascade,
  refresh_token text,
  access_token text,
  expiry timestamptz,
  provider text default 'google',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.gmail_credentials enable row level security;

drop policy if exists "gmail_credentials no anon" on public.gmail_credentials;
create policy "gmail_credentials no anon" on public.gmail_credentials
  for all
  using (false)
  with check (false);

-- trigger to update updated_at
create or replace function public.handle_gmail_credentials_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gmail_credentials_updated_at on public.gmail_credentials;
create trigger trg_gmail_credentials_updated_at
before update on public.gmail_credentials
for each row execute procedure public.handle_gmail_credentials_updated_at();
