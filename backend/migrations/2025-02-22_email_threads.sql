-- Email outreach storage: threads, messages, lead recipient email

alter table public.leads
add column if not exists email text;

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  gmail_account_id uuid references public.gmail_accounts(id) on delete cascade,
  thread_id text,
  subject text,
  last_message_at timestamptz default now(),
  status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_email_threads_lead on public.email_threads(lead_id);
create index if not exists idx_email_threads_thread_id on public.email_threads(thread_id);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.email_threads(id) on delete cascade,
  gmail_message_id text,
  direction text check (direction in ('sent','inbound')),
  subject text,
  snippet text,
  body_html text,
  sent_at timestamptz default now(),
  opened_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_email_messages_thread on public.email_messages(thread_id);
create unique index if not exists idx_email_messages_gmail on public.email_messages(thread_id, gmail_message_id);

create or replace function public.handle_email_messages_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_email_messages_updated_at on public.email_messages;
create trigger trg_email_messages_updated_at
before update on public.email_messages
for each row execute procedure public.handle_email_messages_updated_at();

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
for each row execute procedure public.handle_email_threads_updated_at();
