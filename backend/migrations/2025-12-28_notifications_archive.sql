-- 2025-12-28: Add archived_at to notifications for Inbox/Archive UX
-- Allows soft-archiving without deleting; RLS policies already allow update/delete by owner.

BEGIN;

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

-- Index to make inbox/archive queries by user fast
CREATE INDEX IF NOT EXISTS idx_notifications_user_archived_created
  ON public.notifications (user_id, archived_at, created_at DESC);

COMMIT;
