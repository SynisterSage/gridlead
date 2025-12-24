-- Add subscription/plan fields to profiles for pricing enforcement
alter table public.profiles
    add column if not exists plan text not null default 'starter',
    add column if not exists plan_status text not null default 'active',
    add column if not exists leads_used_this_month integer not null default 0,
    add column if not exists sender_seats_used integer not null default 0;

comment on column public.profiles.plan is 'starter | studio | agency_waitlist';
comment on column public.profiles.plan_status is 'active | past_due | canceled';
comment on column public.profiles.leads_used_this_month is 'Running count of leads scanned in the current billing month';
comment on column public.profiles.sender_seats_used is 'Cached count of connected Gmail accounts for plan limit enforcement';
