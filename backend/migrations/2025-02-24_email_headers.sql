-- Add Gmail threading metadata for replies

alter table public.email_messages
  add column if not exists gmail_thread_id text,
  add column if not exists message_id_header text;

create index if not exists idx_email_messages_gmail_thread on public.email_messages(gmail_thread_id);

