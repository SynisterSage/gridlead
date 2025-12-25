-- Migration: add hidden_from_ui column to leads and provide an RPC to hide/unhide leads

BEGIN;

-- 1) Add the column to persist UI-hiding without removing the row (preserves quota)
ALTER TABLE IF EXISTS public.leads
  ADD COLUMN IF NOT EXISTS hidden_from_ui boolean NOT NULL DEFAULT false;

-- 2) Add an index to make queries that filter hidden fast for a user
CREATE INDEX IF NOT EXISTS idx_leads_user_hidden ON public.leads USING btree (user_id, hidden_from_ui);

-- 3) Provide a Postgres function (RPC) to hide/unhide a lead for the current authenticated user
--    This function uses auth.uid() to ensure ownership; it returns the updated row(s).

CREATE OR REPLACE FUNCTION public.hide_lead(p_lead_id uuid, p_hidden boolean)
RETURNS SETOF public.leads
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE public.leads
  SET hidden_from_ui = p_hidden,
      updated_at = now()
  WHERE id = p_lead_id
    AND user_id = auth.uid()::uuid
  RETURNING *;
END;
$$ STABLE;

-- 4) (Optional) Keep existing triggers intact. No changes to quota triggers are made here.

COMMIT;
