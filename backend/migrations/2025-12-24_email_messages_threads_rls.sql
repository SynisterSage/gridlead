
-- 2025-12-24: Create email_messages table and add RLS policies
-- Creates the table (if missing), indexes, updated_at trigger, and RLS
-- policies that compare UUID columns to auth.uid()::uuid to avoid
-- uuid=text operator errors.

begin;

-- Table
create table if not exists public.email_messages (
	id uuid not null default gen_random_uuid(),
	thread_id uuid null,
	gmail_message_id text null,
	direction text null,
	subject text null,
	snippet text null,
	body_html text null,
	sent_at timestamp with time zone null default now(),
	opened_at timestamp with time zone null,
	created_at timestamp with time zone null default now(),
	updated_at timestamp with time zone null default now(),
	gmail_thread_id text null,
	message_id_header text null,
	constraint email_messages_pkey primary key (id),
	constraint email_messages_thread_id_fkey foreign key (thread_id) references public.email_threads (id) on delete cascade,
	constraint email_messages_direction_check check (
		(
			direction = any (array['sent'::text, 'inbound'::text])
		)
	)
);

create index if not exists idx_email_messages_thread on public.email_messages using btree (thread_id);
create unique index if not exists idx_email_messages_gmail on public.email_messages using btree (thread_id, gmail_message_id);
create index if not exists idx_email_messages_gmail_thread on public.email_messages using btree (gmail_thread_id);

-- updated_at trigger function and trigger
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
	for each row
	execute function public.handle_email_messages_updated_at();

-- Enable RLS
alter table if exists public.email_messages enable row level security;

-- RLS policies: visible to owner via thread -> lead or thread -> gmail_account

drop policy if exists "email_messages viewable by owner" on public.email_messages;
create policy "email_messages viewable by owner" on public.email_messages
	for select using (
		(
			exists (
				select 1 from public.email_threads et
				join public.leads l on l.id = et.lead_id
				where et.id = public.email_messages.thread_id and l.user_id = auth.uid()::uuid
			)
		)
		or
		(
			exists (
				select 1 from public.email_threads et
				join public.gmail_accounts g on g.id = et.gmail_account_id
				where et.id = public.email_messages.thread_id and g.user_id = auth.uid()::uuid
			)
		)
	);

drop policy if exists "email_messages insertable by owner" on public.email_messages;
create policy "email_messages insertable by owner" on public.email_messages
	for insert with check (
		(
			thread_id is null
			or exists (
				select 1 from public.email_threads et
				join public.leads l on l.id = et.lead_id
				where et.id = thread_id and l.user_id = auth.uid()::uuid
			)
		)
		or
		(
			thread_id is null
			or exists (
				select 1 from public.email_threads et
				join public.gmail_accounts g on g.id = et.gmail_account_id
				where et.id = thread_id and g.user_id = auth.uid()::uuid
			)
		)
	);

drop policy if exists "email_messages updatable by owner" on public.email_messages;
create policy "email_messages updatable by owner" on public.email_messages
	for update using (
		(
			exists (
				select 1 from public.email_threads et
				join public.leads l on l.id = et.lead_id
				where et.id = public.email_messages.thread_id and l.user_id = auth.uid()::uuid
			)
		)
		or
		(
			exists (
				select 1 from public.email_threads et
				join public.gmail_accounts g on g.id = et.gmail_account_id
				where et.id = public.email_messages.thread_id and g.user_id = auth.uid()::uuid
			)
		)
	);

drop policy if exists "email_messages deletable by owner" on public.email_messages;
create policy "email_messages deletable by owner" on public.email_messages
	for delete using (
		(
			exists (
				select 1 from public.email_threads et
				join public.leads l on l.id = et.lead_id
				where et.id = public.email_messages.thread_id and l.user_id = auth.uid()::uuid
			)
		)
		or
		(
			exists (
				select 1 from public.email_threads et
				join public.gmail_accounts g on g.id = et.gmail_account_id
				where et.id = public.email_messages.thread_id and g.user_id = auth.uid()::uuid
			)
		)
	);

commit;

