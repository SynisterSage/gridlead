# Technical Specification

## Core Stack Architecture
- **Language**: TypeScript (Strict Mode)
- **Frontend Framework**: React 19 (Functional Components + Hooks)
- **Bundler**: Metro (Optimized for React Native / Web compatibility)
- **Styling**: Tailwind CSS (Utility-first, high-fidelity custom theme)
- **AI Engine**: Google Gemini SDK (`@google/genai`) - Models: `gemini-3-flash-preview` and `gemini-3-pro-preview`.
- **Backend-as-a-Service**: Supabase
    - **Auth**: Supabase Auth (Google OAuth, Email/Password)
    - **Database**: PostgreSQL (Real-time enabled)
    - **Storage**: Supabase Storage (For storing lead site screenshots/PDF audits)
    - **Edge Functions**: For long-running scraper jobs and scheduled outreach.

## Lead Scoring Algorithm
The "Opportunity Score" is a weighted aggregate (0-100):
- **Design (30%)**: AI-vision analysis of site screenshots + CSS audits.
- **Performance (30%)**: LCP, TBT, and CLS scores via PageSpeed Insights.
- **Trust (20%)**: Review sentiment and Google Maps rating delta.
- **Security (20%)**: SSL presence, security headers, and modern tech-stack fingerprinting.

## Development Environment
- **Bundler Config**: Metro configuration optimized for TypeScript module resolution.
- **API Strategy**: Proxying scraping requests through residential rotating proxies to avoid rate-limiting.
- **Types**: All lead statuses and score objects are strictly typed in `types.ts`.

## Environment Variables
```env
# Gemini AI
API_KEY=your_gemini_api_key

# Supabase Configuration
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_public_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_private_key

# Third-Party Audit Keys
GOOGLE_MAPS_KEY=your_maps_key
PAGESPEED_KEY=your_pagespeed_insights_key
```