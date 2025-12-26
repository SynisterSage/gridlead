-- Add waitlist tracking to profiles without changing plan
alter table public.profiles
  add column if not exists agency_waitlist_status text,
  add column if not exists agency_waitlist_requested_at timestamptz;

comment on column public.profiles.agency_waitlist_status is 'Status of Agency+ waitlist request (pending, approved, closed)';
comment on column public.profiles.agency_waitlist_requested_at is 'Timestamp when Agency+ waitlist was last requested';
