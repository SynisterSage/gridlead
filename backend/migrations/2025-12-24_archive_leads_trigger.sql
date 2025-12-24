-- Add archived_at columns to leads and email_threads + trigger to set/clear archives
BEGIN;

-- 1) add archived_at columns if missing
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- 2) indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_leads_archived_at ON public.leads (archived_at);
CREATE INDEX IF NOT EXISTS idx_email_threads_archived_at ON public.email_threads (archived_at);

-- 3) backfill existing 'won' leads to archived (optional for initial roll-out)
UPDATE public.leads
SET archived_at = now()
WHERE status = 'won' AND archived_at IS NULL;

-- 4) create / replace trigger function to set archived_at on status transitions
CREATE OR REPLACE FUNCTION public.handle_lead_status_archive()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Only act on UPDATEs
  IF TG_OP = 'UPDATE' THEN
    -- If status changed into an archived state, set archived_at and mark threads
    IF (NEW.status IS DISTINCT FROM OLD.status) AND (NEW.status IN ('won','stale','lost')) THEN
      IF NEW.archived_at IS NULL THEN
        NEW.archived_at := now();
      END IF;
      -- archive related threads that aren't already archived
      UPDATE public.email_threads
      SET archived_at = now()
      WHERE lead_id = NEW.id AND archived_at IS NULL;

    -- If status changed out of an archived state, clear archived_at on lead and its threads
    ELSIF (NEW.status IS DISTINCT FROM OLD.status) AND (OLD.status IN ('won','stale','lost') AND NOT (NEW.status IN ('won','stale','lost'))) THEN
      NEW.archived_at := NULL;
      UPDATE public.email_threads
      SET archived_at = NULL
      WHERE lead_id = NEW.id AND archived_at IS NOT NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) create trigger (BEFORE UPDATE so we can modify NEW.archived_at)
DROP TRIGGER IF EXISTS trg_lead_status_archive ON public.leads;
CREATE TRIGGER trg_lead_status_archive
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_status_archive();

COMMIT;

-- NOTES:
-- - This migration marks leads with status 'won' as archived and sets the same timestamp
--   on related email_threads. Un-archiving (status changed away from won/stale/lost) clears
--   the timestamps.
-- - You should decide whether archived leads should count toward monthly quotas; if not,
--   update quota enforcement functions to exclude rows where archived_at IS NOT NULL.
-- - After deploying, update server functions and frontend queries to default-filter
--   `archived_at IS NULL` unless explicitly requesting archived items.
