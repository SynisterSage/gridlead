-- 2025-12-24: Create email_threads table and add RLS policies
-- Creates the table (if missing), indexes, updated_at trigger, and RLS
-- policies that compare UUID columns to auth.uid()::uuid to avoid
-- uuid=text operator errors.

begin;

-- Table
create table if not exists public.email_threads (
  id uuid not null default gen_random_uuid(),
  lead_id uuid null,
  gmail_account_id uuid null,
  thread_id text null,
  subject text null,
  last_message_at timestamp with time zone null default now(),
  status text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint email_threads_pkey primary key (id),
  constraint email_threads_gmail_account_id_fkey foreign key (gmail_account_id) references public.gmail_accounts (id) on delete cascade,
  constraint email_threads_lead_id_fkey foreign key (lead_id) references public.leads (id) on delete cascade
) tablespace pg_default;

create index if not exists idx_email_threads_lead on public.email_threads using btree (lead_id) tablespace pg_default;
create index if not exists idx_email_threads_thread_id on public.email_threads using btree (thread_id) tablespace pg_default;

-- updated_at trigger function and trigger
create or replace function public.handle_email_threads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_email_threads_updated_at on public.email_threads;
create trigger trg_email_threads_updated_at
  before update on public.email_threads
  for each row
  execute function public.handle_email_threads_updated_at();

-- Enable RLS
alter table if exists public.email_threads enable row level security;

-- RLS policies: visible to lead owner or gmail_account owner
drop policy if exists "email_threads viewable by owner" on public.email_threads;
create policy "email_threads viewable by owner" on public.email_threads
  for select using (
    (
      exists (
        select 1 from public.leads l where l.id = public.email_threads.lead_id and l.user_id = auth.uid()::uuid
      )
    )
    or
    (
      exists (
        select 1 from public.gmail_accounts g where g.id = public.email_threads.gmail_account_id and g.user_id = auth.uid()::uuid
      )
    )
  );

drop policy if exists "email_threads insertable by owner" on public.email_threads;
create policy "email_threads insertable by owner" on public.email_threads
  for insert with check (
    (
      lead_id is null
      or exists (
        select 1 from public.leads l where l.id = lead_id and l.user_id = auth.uid()::uuid
      )
    )
    or
    (
      gmail_account_id is null
      or exists (
        select 1 from public.gmail_accounts g where g.id = gmail_account_id and g.user_id = auth.uid()::uuid
      )
    )
  );

drop policy if exists "email_threads updatable by owner" on public.email_threads;
create policy "email_threads updatable by owner" on public.email_threads
  for update using (
    (
      exists (
        select 1 from public.leads l where l.id = public.email_threads.lead_id and l.user_id = auth.uid()::uuid
      )
    )
    or
    (
      exists (
        select 1 from public.gmail_accounts g where g.id = public.email_threads.gmail_account_id and g.user_id = auth.uid()::uuid
      )
    )
  );

drop policy if exists "email_threads deletable by owner" on public.email_threads;
create policy "email_threads deletable by owner" on public.email_threads
  for delete using (
    (
      exists (
        select 1 from public.leads l where l.id = public.email_threads.lead_id and l.user_id = auth.uid()::uuid
      )
    )
    or
    (
      exists (
        select 1 from public.gmail_accounts g where g.id = public.email_threads.gmail_account_id and g.user_id = auth.uid()::uuid
      )
    )
  );

commit;
