-- Ensure we track which month the lead counter applies to
alter table public.profiles
  add column if not exists leads_usage_period date not null default date_trunc('month', now());

create or replace function enforce_lead_quota()
returns trigger as $$
declare
  profile_row public.profiles%rowtype;
  current_period date := date_trunc('month', timezone('utc', now()));
  plan_limit integer;
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

  if plan_limit is not null and profile_row.leads_used_this_month >= plan_limit then
    raise exception 'Lead limit reached. Upgrade plan to continue.';
  end if;

  update public.profiles
     set leads_usage_period = profile_row.leads_usage_period,
         leads_used_this_month = profile_row.leads_used_this_month + 1
   where id = profile_row.id;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_quota on public.leads;

create trigger trg_leads_quota
before insert on public.leads
for each row execute function enforce_lead_quota();
