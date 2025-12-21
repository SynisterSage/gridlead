# GridLead: Detailed Production Roadmap

## Phase 1: Environment & Supabase Sync (Weeks 1-2)
*   **Metro Workspace Setup**: Configure the Metro bundler for high-performance TypeScript compilation and asset handling.
*   **Supabase Schema Architecture**:
    *   Initialize `profiles` table with RLS (Row Level Security) linked to `auth.users`.
    *   Create `leads` table with JSONB column for the `score` object to allow for flexible audit data.
    *   Setup `outreach_logs` for tracking every email sent via the Gmail API.
*   **Auth Implementation**: Integrate Supabase Auth UI/SDK. Configure Google OAuth with required scopes for Gmail interaction.

## Phase 2: The "Deep Discovery" Engine (Weeks 3-5)
*   **Real-time Places API**: Connect `HeroDiscovery.tsx` to the Google Places API via a Supabase Edge Function to keep API keys hidden.
*   **Automated Scraper Microservice**: 
    *   Build a Node.js/Puppeteer service (or use a serverless provider) to crawl discovered URLs.
    *   Implement "Visual Analysis": Capture screenshots and upload to Supabase Storage for AI-vision design audits.
*   **Lead Staging**: Implement optimistic UI updates when moving leads from "Found" to "Review" using TanStack Query.

## Phase 3: AI-Enhanced Outreach (Weeks 6-8)
*   **Gemini Context Injection**: Refine `generateOutreachEmail` to include the specific "Pain Points" found during the scraper phase.
*   **Gmail Integration**: 
    *   Implement a robust SMTP/OAuth2 bridge.
    *   Build the "Outbox Queue" to handle rate-limiting (e.g., 50 emails/hour) to protect domain health.
*   **Reply Tracking**: Setup a webhook or polling service to detect prospect replies and auto-update lead status to `responded`.

## Phase 4: Intelligence & Analytics (Weeks 9-11)
*   **Dashboard Logic**: Connect `Dashboard.tsx` to real Supabase metrics. 
    *   Calculate "Pipeline Value" dynamically from active `approved` leads.
    *   Generate the "Weekly Volume" chart using real outreach timestamp data.
*   **Advanced AI Filters**: Implement "Smart Lead Filtering" where the AI suggests the top 5 leads to contact today based on "warmth" and "deficit severity."

## Phase 5: Polishing & Scaling (Week 12+)
*   **Subscription Logic**: Integrate Stripe Billing with Supabase for Tier-based access (Solo vs. Agency).
*   **Multi-tenant Workspaces**: Allow agencies to invite team members with shared lead pools.
*   **Public API**: Release a limited API for users to push leads into GridLead from external sources.