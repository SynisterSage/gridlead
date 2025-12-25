-- Fix: hide_lead must not be STABLE because it performs UPDATEs
-- Replace the existing hide_lead function and mark it VOLATILE.

BEGIN;

CREATE OR REPLACE FUNCTION public.hide_lead(p_lead_id uuid, p_hidden boolean)
RETURNS SETOF public.leads
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.leads
  SET hidden_from_ui = p_hidden,
      updated_at = now()
  WHERE id = p_lead_id
    AND user_id = auth.uid()::uuid
  RETURNING *;
END;
$$;

COMMIT;
