-- 2025-01-23: store Gmail avatar on accounts

alter table if exists public.gmail_accounts
  add column if not exists avatar_url text;
