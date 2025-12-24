-- 2025-12-24: Extend email_messages RLS to consider gmail_thread_id
-- This migration updates the RLS policies so messages are visible when
-- they are linked to a thread either by `thread_id` (db PK) or by
-- `gmail_thread_id` matching `email_threads.thread_id` (Gmail's thread id).
-- This addresses cases where messages were inserted with only `gmail_thread_id`.

begin;

alter table if exists public.email_messages enable row level security;

-- Replace view policy
drop policy if exists "email_messages viewable by owner" on public.email_messages;
create policy "email_messages viewable by owner" on public.email_messages
  for select using (
    (
      exists (
        select 1 from public.email_threads et
        join public.leads l on l.id = et.lead_id
        where (
          (et.id = public.email_messages.thread_id)
          or (et.thread_id = public.email_messages.gmail_thread_id)
        )
        and l.user_id = auth.uid()::uuid
      )
    )
    or
    (
      exists (
        select 1 from public.email_threads et
        join public.gmail_accounts g on g.id = et.gmail_account_id
        where (
          (et.id = public.email_messages.thread_id)
          or (et.thread_id = public.email_messages.gmail_thread_id)
        )
        and g.user_id = auth.uid()::uuid
      )
    )
  );

-- Insert policy: allow inserting messages that reference a thread via thread_id
-- or via gmail_thread_id that maps to an email_threads.thread_id owned by the user
drop policy if exists "email_messages insertable by owner" on public.email_messages;
create policy "email_messages insertable by owner" on public.email_messages
  for insert with check (
    (
      thread_id is null
      or exists (
        select 1 from public.email_threads et
        join public.leads l on l.id = et.lead_id
        where (
          (et.id = thread_id)
          or (et.thread_id = gmail_thread_id)
        )
        and l.user_id = auth.uid()::uuid
      )
    )
    or
    (
      thread_id is null
      or exists (
        select 1 from public.email_threads et
        join public.gmail_accounts g on g.id = et.gmail_account_id
        where (
          (et.id = thread_id)
          or (et.thread_id = gmail_thread_id)
        )
        and g.user_id = auth.uid()::uuid
      )
    )
  );

-- Update policy: allow updates by owners via either thread_id or gmail_thread_id mapping
drop policy if exists "email_messages updatable by owner" on public.email_messages;
create policy "email_messages updatable by owner" on public.email_messages
  for update using (
    (
      exists (
        select 1 from public.email_threads et
        join public.leads l on l.id = et.lead_id
        where (
          (et.id = public.email_messages.thread_id)
          or (et.thread_id = public.email_messages.gmail_thread_id)
        )
        and l.user_id = auth.uid()::uuid
      )
    )
    or
    (
      exists (
        select 1 from public.email_threads et
        join public.gmail_accounts g on g.id = et.gmail_account_id
        where (
          (et.id = public.email_messages.thread_id)
          or (et.thread_id = public.email_messages.gmail_thread_id)
        )
        and g.user_id = auth.uid()::uuid
      )
    )
  );

-- Delete policy: mirror update policy
drop policy if exists "email_messages deletable by owner" on public.email_messages;
create policy "email_messages deletable by owner" on public.email_messages
  for delete using (
    (
      exists (
        select 1 from public.email_threads et
        join public.leads l on l.id = et.lead_id
        where (
          (et.id = public.email_messages.thread_id)
          or (et.thread_id = public.email_messages.gmail_thread_id)
        )
        and l.user_id = auth.uid()::uuid
      )
    )
    or
    (
      exists (
        select 1 from public.email_threads et
        join public.gmail_accounts g on g.id = et.gmail_account_id
        where (
          (et.id = public.email_messages.thread_id)
          or (et.thread_id = public.email_messages.gmail_thread_id)
        )
        and g.user_id = auth.uid()::uuid
      )
    )
  );

commit;
