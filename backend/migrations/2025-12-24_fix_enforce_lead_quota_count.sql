-- 2025-12-24: Make enforce_lead_quota idempotent by computing actual lead count
-- This replaces the previous function to avoid double-counting when the
-- trigger might be evaluated multiple times in edge cases.

begin;

create or replace function public.enforce_lead_quota()
returns trigger as $$
declare
  profile_row public.profiles%rowtype;
  current_period date := date_trunc('month', timezone('utc', now()));
  plan_limit integer;
  actual_count integer := 0;
begin
  select * into profile_row
    from public.profiles
   where id = new.user_id
   for update;

  if not found then
    raise exception 'Profile not found for user %', new.user_id;
  end if;

  if profile_row.leads_usage_period is distinct from current_period then
    profile_row.leads_usage_period := current_period;
    profile_row.leads_used_this_month := 0;
  end if;

  plan_limit := case profile_row.plan
    when 'studio' then 1000
    when 'agency_waitlist' then null
    else 50
  end;

  -- Compute the authoritative count of leads for the current month for this user.
  select count(*) into actual_count
    from public.leads l
    where l.user_id = new.user_id
      and date_trunc('month', timezone('utc', l.created_at)) = current_period;

  -- Since this is BEFORE INSERT, the new lead is not yet counted; we will
  -- set the counter to actual_count + 1 (which is idempotent even if the
  -- function runs multiple times for the same insert event).
  if plan_limit is not null and (actual_count + 1) > plan_limit then
    raise exception 'Lead limit reached. Upgrade plan to continue.';
  end if;

  update public.profiles
     set leads_usage_period = profile_row.leads_usage_period,
         leads_used_this_month = actual_count + 1
   where id = profile_row.id;

  return new;
end;
$$ language plpgsql;

-- Ensure the trigger exists and points to the updated function
drop trigger if exists trg_leads_quota on public.leads;
create trigger trg_leads_quota
before insert on public.leads
for each row execute function public.enforce_lead_quota();

commit;
