-- Agency+ waitlist table
create table if not exists public.agency_waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  company text,
  use_case text,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint agency_waitlist_user_unique unique (user_id)
);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_agency_waitlist_updated_at on public.agency_waitlist;
create trigger trg_agency_waitlist_updated_at
before update on public.agency_waitlist
for each row
execute function public.set_updated_at();

alter table public.agency_waitlist enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agency_waitlist' and policyname = 'Allow own waitlist rows'
  ) then
    create policy "Allow own waitlist rows"
    on public.agency_waitlist
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end$$;
