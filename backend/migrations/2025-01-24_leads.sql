-- 2025-01-24: leads table for discovery/review/outreach

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  place_id text,
  name text not null,
  category text,
  rating numeric,
  website text,
  address text,
  score_design integer,
  score_performance integer,
  score_reviews integer,
  score_trust integer,
  lat double precision,
  lng double precision,
  status text default 'pending',
  draft_subject text,
  draft_body text,
  sent_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_leads_user on public.leads(user_id);
create unique index if not exists idx_leads_user_place on public.leads(user_id, place_id) where place_id is not null;

alter table public.leads enable row level security;

drop policy if exists "leads viewable by owner" on public.leads;
create policy "leads viewable by owner" on public.leads
  for select using (auth.uid() = user_id);

drop policy if exists "leads insertable by owner" on public.leads;
create policy "leads insertable by owner" on public.leads
  for insert with check (auth.uid() = user_id);

drop policy if exists "leads updatable by owner" on public.leads;
create policy "leads updatable by owner" on public.leads
  for update using (auth.uid() = user_id);

drop policy if exists "leads deletable by owner" on public.leads;
create policy "leads deletable by owner" on public.leads
  for delete using (auth.uid() = user_id);

create or replace function public.handle_leads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row execute procedure public.handle_leads_updated_at();
