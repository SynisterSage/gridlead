-- 2025-12-24: Remove redundant after-insert trigger/function that increments leads counter
-- Some environments had an `increment_leads_usage` AFTER INSERT trigger which
-- caused the profiles.leads_used_this_month to be incremented twice (once
-- by enforce_lead_quota and once by this trigger). Drop them idempotently.

begin;

-- Drop the after-insert trigger if present
drop trigger if exists trg_leads_usage_after on public.leads;

-- Drop the helper function if present (it's safe to recreate later if needed)
drop function if exists public.increment_leads_usage() cascade;

commit;
