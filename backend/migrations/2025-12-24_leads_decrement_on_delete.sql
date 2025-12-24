-- 2025-12-24: Decrement profiles.leads_used_this_month when a lead is deleted
-- Ensures the monthly counter stays accurate if leads are removed.

begin;

create or replace function public.handle_leads_decrement_on_delete()
returns trigger as $$
declare
  profile_row public.profiles%rowtype;
  current_period date := date_trunc('month', timezone('utc', now()));
begin
  -- Find profile row for the lead owner
  select * into profile_row
    from public.profiles
   where id = old.user_id
   for update;

  if not found then
    return old;
  end if;

  -- Only decrement if the usage period matches current month and counter > 0
  if profile_row.leads_usage_period is distinct from current_period then
    -- If the period has rotated, counter is effectively 0 for current month
    return old;
  end if;

  if coalesce(profile_row.leads_used_this_month, 0) > 0 then
    update public.profiles
      set leads_used_this_month = leads_used_this_month - 1
    where id = profile_row.id;
  end if;

  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_decrement_on_delete on public.leads;
create trigger trg_leads_decrement_on_delete
  after delete on public.leads
  for each row
  execute function public.handle_leads_decrement_on_delete();

commit;
