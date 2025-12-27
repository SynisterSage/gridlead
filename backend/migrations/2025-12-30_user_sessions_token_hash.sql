-- 2025-12-30: Track a hash of the auth access token per session to distinguish new logins

BEGIN;

ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS token_hash text NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_token_hash
  ON public.user_sessions (user_id, token_hash);

COMMIT;
