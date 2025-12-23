-- Extend user_notifications with additional triggers and updated_at handler
create or replace function handle_user_notifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.user_notifications
  add column if not exists send_failed boolean default true,
  add column if not exists gmail_disconnected boolean default true,
  add column if not exists goal_hit boolean default true,
  add column if not exists lead_assigned boolean default true,
  add column if not exists pipeline_threshold boolean default false;

drop trigger if exists trg_user_notifications_updated_at on public.user_notifications;
create trigger trg_user_notifications_updated_at
before update on public.user_notifications
for each row execute function handle_user_notifications_updated_at();
