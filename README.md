# GridLead

GridLead is a Supabase + React/Vite prototype for onboarding agencies, connecting Gmail, and managing outreach settings. It includes onboarding, profile storage, Gmail OAuth, and notification preferences.

## Stack
- React + Vite + TypeScript
- Supabase (auth, Postgres, Edge Functions)
- Tailwind/CSS utilities

## Getting Started
1. Install deps: `npm install`
2. Create `.env.local` with:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_GMAIL_OAUTH_CLIENT_ID=your-google-client-id
   VITE_GMAIL_OAUTH_REDIRECT_URI=https://YOUR-PROJECT.supabase.co/functions/v1/gmail-oauth/callback
   ```
   Keep secrets (service role, client secret) in Supabase Edge Function secrets, not in `.env.local`.
3. Run dev server: `npm run dev`

## Database
Run migrations in `backend/migrations/` on your Supabase project (order by date):
- `2025-01-20_profiles.sql` (profiles + RLS)
- `2025-01-21_gmail.sql` (gmail_accounts)
- `2025-01-22_gmail_credentials_public.sql`
- `2025-01-23_gmail_accounts_primary.sql`
- `2025-01-23_gmail_accounts_avatar.sql`
- `2025-01-23_user_notifications.sql`

Notification defaults (leads/replies on, weekly/browser off) are auto-created when a profile is first saved.

## Edge Function: Gmail OAuth
Path: `supabase/functions/gmail-oauth/index.ts`
Secrets to set in Supabase:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_OAUTH_CLIENT_ID`
- `GMAIL_OAUTH_CLIENT_SECRET`
- `GMAIL_OAUTH_REDIRECT_URI` (matches Google OAuth client)
- `APP_REDIRECT_URL` (e.g., `http://localhost:3000`)

Deploy the function from Supabase: `supabase functions deploy gmail-oauth`

## Gmail OAuth client
- Create a Web OAuth client in Google Cloud.
- Authorized redirect URIs: `https://YOUR-PROJECT.supabase.co/functions/v1/gmail-oauth/callback`
- Scopes used: `email profile openid https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly`

## Features
- Email/Google auth onboarding
- Profile capture (display/agency/monthly goal)
- Gmail connect (multiple accounts, primary flag, avatars)
- Notification preferences persisted in `user_notifications`
- Settings with theme toggle, bio (saved locally), and security section

## Security / Legal
- Do not commit Supabase service role keys or Google client secrets.
- Edge Function uses service role; keep those values in Supabase secrets only.
- Review RLS policies before production use.

## Scripts
- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run preview` — preview build

## Discovery (Google Places)
- Edge Function: `backend/supabase/functions/discover/index.ts`
- Secrets needed (Supabase): `PLACES_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Table: `public.leads` (migration `2025-01-24_leads.sql`) stores staged leads with RLS (owner-only).
- Deployment: `supabase secrets set PLACES_API_KEY=your-key` then `supabase functions deploy discover`
