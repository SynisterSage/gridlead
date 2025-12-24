-- 2025-12-24: Create notifications table (if missing) and add trigger
-- Insert an in-app notification when an inbound email message is received
-- Only create notifications for users who have replies enabled in user_notifications

begin;

-- Create notifications table if it doesn't exist (schema as provided)
create table if not exists public.notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  type text not null default 'info'::text,
  title text not null,
  body text not null,
  meta jsonb null default '{}'::jsonb,
  channel text null default 'in_app'::text,
  read_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint notifications_pkey primary key (id),
  constraint notifications_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade
) tablespace pg_default;

create index if not exists idx_notifications_user_created_at on public.notifications using btree (user_id, created_at desc) tablespace pg_default;

-- Enable basic RLS on notifications so clients only see their own notifications
alter table if exists public.notifications enable row level security;

drop policy if exists "notifications viewable by owner" on public.notifications;
create policy "notifications viewable by owner" on public.notifications
  for select using (user_id = auth.uid()::uuid);

drop policy if exists "notifications insertable by owner" on public.notifications;
create policy "notifications insertable by owner" on public.notifications
  for insert with check (user_id = auth.uid()::uuid);

drop policy if exists "notifications updatable by owner" on public.notifications;
create policy "notifications updatable by owner" on public.notifications
  for update using (user_id = auth.uid()::uuid);

drop policy if exists "notifications deletable by owner" on public.notifications;
create policy "notifications deletable by owner" on public.notifications
  for delete using (user_id = auth.uid()::uuid);

-- Notification trigger: insert notification when an inbound email_message is created
create or replace function public.handle_email_messages_notify()
returns trigger as $$
declare
  target_user uuid;
  want_reply boolean;
  note_title text;
  note_body text;
  meta jsonb;
begin
  -- Only act on inserts
  if (TG_OP <> 'INSERT') then
    return new;
  end if;

  -- Only notify on inbound messages
  if coalesce(new.direction, '') <> 'inbound' then
    return new;
  end if;

  target_user := NULL;

  -- Try to determine the owning user via thread -> lead -> user_id
  if new.thread_id is not null then
    select l.user_id into target_user
    from public.email_threads et
    left join public.leads l on l.id = et.lead_id
    where et.id = new.thread_id
    limit 1;

    -- Fallback: thread -> gmail_account -> user
    if target_user is null then
      select g.user_id into target_user
      from public.email_threads et
      join public.gmail_accounts g on g.id = et.gmail_account_id
      where et.id = new.thread_id
      limit 1;
    end if;
  end if;

  -- If we still don't have a target user, nothing to do
  if target_user is null then
    return new;
  end if;

  -- Respect user's notification preferences: only create if replies enabled
  select coalesce((select replies from public.user_notifications where user_id = target_user), true) into want_reply;
  if not want_reply then
    return new;
  end if;

  -- Build a short body and meta information
  note_title := 'New reply received';
  if new.snippet is not null and length(trim(new.snippet)) > 0 then
    note_body := left(new.snippet, 240);
  elsif new.body_html is not null then
    note_body := left(regexp_replace(new.body_html, '<[^>]*>', '', 'g'), 240);
  else
    note_body := 'You received a reply to your outreach.';
  end if;

  meta := jsonb_build_object('thread_id', new.thread_id, 'gmail_message_id', new.gmail_message_id, 'gmail_thread_id', new.gmail_thread_id);

  -- Insert an in-app notification; service-role and trigger context will bypass RLS
  insert into public.notifications (user_id, type, title, body, meta, channel, created_at)
  values (target_user, 'reply', note_title, coalesce(note_body, ''), meta, 'in_app', now());

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_email_messages_notify on public.email_messages;
create trigger trg_email_messages_notify
  after insert on public.email_messages
  for each row
  execute function public.handle_email_messages_notify();

commit;
