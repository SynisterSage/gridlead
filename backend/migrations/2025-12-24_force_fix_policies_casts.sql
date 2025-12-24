-- 2025-12-24: Force-fix RLS policies listed in pg_policies to cast auth.uid() to uuid
-- This migration replaces the specific live policies you showed so the
-- database no longer compares uuid columns to text (auth.uid()).

BEGIN;

-- Profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;
CREATE POLICY "Profiles are viewable by owner" ON public.profiles
  FOR SELECT USING (auth.uid()::uuid = id);
DROP POLICY IF EXISTS "Profiles are insertable by owner" ON public.profiles;
CREATE POLICY "Profiles are insertable by owner" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid()::uuid = id);
DROP POLICY IF EXISTS "Profiles are updatable by owner" ON public.profiles;
CREATE POLICY "Profiles are updatable by owner" ON public.profiles
  FOR UPDATE USING (auth.uid()::uuid = id);

-- Email threads (the versions you returned)
ALTER TABLE IF EXISTS public.email_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_threads viewable by owner" ON public.email_threads;
CREATE POLICY "email_threads viewable by owner" ON public.email_threads
  FOR SELECT USING (
    (
      EXISTS (
        SELECT 1 FROM public.leads l WHERE l.id = public.email_threads.lead_id AND l.user_id = auth.uid()::uuid
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM public.gmail_accounts g WHERE g.id = public.email_threads.gmail_account_id AND g.user_id = auth.uid()::uuid
      )
    )
  );

DROP POLICY IF EXISTS "email_threads insertable by owner" ON public.email_threads;
CREATE POLICY "email_threads insertable by owner" ON public.email_threads
  FOR INSERT WITH CHECK (
    (
      lead_id IS NULL
      OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.user_id = auth.uid()::uuid)
    )
    OR
    (
      gmail_account_id IS NULL
      OR EXISTS (SELECT 1 FROM public.gmail_accounts g WHERE g.id = gmail_account_id AND g.user_id = auth.uid()::uuid)
    )
  );

DROP POLICY IF EXISTS "email_threads updatable by owner" ON public.email_threads;
CREATE POLICY "email_threads updatable by owner" ON public.email_threads
  FOR UPDATE USING (
    (
      EXISTS (SELECT 1 FROM public.leads l WHERE l.id = public.email_threads.lead_id AND l.user_id = auth.uid()::uuid)
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.gmail_accounts g WHERE g.id = public.email_threads.gmail_account_id AND g.user_id = auth.uid()::uuid)
    )
  );

DROP POLICY IF EXISTS "email_threads deletable by owner" ON public.email_threads;
CREATE POLICY "email_threads deletable by owner" ON public.email_threads
  FOR DELETE USING (
    (
      EXISTS (SELECT 1 FROM public.leads l WHERE l.id = public.email_threads.lead_id AND l.user_id = auth.uid()::uuid)
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.gmail_accounts g WHERE g.id = public.email_threads.gmail_account_id AND g.user_id = auth.uid()::uuid)
    )
  );

-- Gmail accounts
ALTER TABLE IF EXISTS public.gmail_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gmail accounts viewable by owner" ON public.gmail_accounts;
CREATE POLICY "gmail accounts viewable by owner" ON public.gmail_accounts
  FOR SELECT USING (auth.uid()::uuid = user_id);
DROP POLICY IF EXISTS "gmail accounts insertable by owner" ON public.gmail_accounts;
CREATE POLICY "gmail accounts insertable by owner" ON public.gmail_accounts
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);
DROP POLICY IF EXISTS "gmail accounts updatable by owner" ON public.gmail_accounts;
CREATE POLICY "gmail accounts updatable by owner" ON public.gmail_accounts
  FOR UPDATE USING (auth.uid()::uuid = user_id);
DROP POLICY IF EXISTS "gmail accounts deletable by owner" ON public.gmail_accounts;
CREATE POLICY "gmail accounts deletable by owner" ON public.gmail_accounts
  FOR DELETE USING (auth.uid()::uuid = user_id);

-- user_notifications
ALTER TABLE IF EXISTS public.user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_notifications viewable by owner" ON public.user_notifications;
CREATE POLICY "user_notifications viewable by owner" ON public.user_notifications
  FOR SELECT USING (auth.uid()::uuid = user_id);
DROP POLICY IF EXISTS "user_notifications insertable by owner" ON public.user_notifications;
CREATE POLICY "user_notifications insertable by owner" ON public.user_notifications
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);
DROP POLICY IF EXISTS "user_notifications updatable by owner" ON public.user_notifications;
CREATE POLICY "user_notifications updatable by owner" ON public.user_notifications
  FOR UPDATE USING (auth.uid()::uuid = user_id);

-- Leads
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads viewable by owner" ON public.leads;
CREATE POLICY "leads viewable by owner" ON public.leads
  FOR SELECT USING (auth.uid()::uuid = user_id);
DROP POLICY IF EXISTS "leads insertable by owner" ON public.leads;
CREATE POLICY "leads insertable by owner" ON public.leads
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);
DROP POLICY IF EXISTS "leads updatable by owner" ON public.leads;
CREATE POLICY "leads updatable by owner" ON public.leads
  FOR UPDATE USING (auth.uid()::uuid = user_id);
DROP POLICY IF EXISTS "leads deletable by owner" ON public.leads;
CREATE POLICY "leads deletable by owner" ON public.leads
  FOR DELETE USING (auth.uid()::uuid = user_id);

COMMIT;
