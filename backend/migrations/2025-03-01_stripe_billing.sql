-- Add Stripe billing fields to profiles
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean default false,
  add column if not exists agency_approved boolean default false;

comment on column public.profiles.stripe_customer_id is 'Stripe customer id (cus_...)';
comment on column public.profiles.stripe_subscription_id is 'Stripe subscription id (sub_...)';
comment on column public.profiles.current_period_end is 'Billing period end timestamp from Stripe';
comment on column public.profiles.cancel_at_period_end is 'If true, subscription will cancel at period end';
comment on column public.profiles.agency_approved is 'Manually set flag to allow Agency+ checkout';
