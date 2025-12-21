# API Integration Reference

## 1. Supabase (Backend & Auth)
### Auth Flow
- **Provider**: Google OAuth 2.0.
- **Scopes**: `openid`, `email`, `profile`, plus Google Search/Gmail scopes if integrated directly.
- **Pattern**: Use `supabase.auth.signInWithOAuth()` on the landing page.

### Data Storage
- **Tables**:
    - `leads`: Primary storage. RLS policies ensure users only see their own leads.
    - `audit_results`: Detailed JSON logs of PageSpeed and SEO checks.
- **Storage Buckets**: 
    - `site-previews`: Publicly accessible (signed) URLs for lead website screenshots used in the Review Queue.

## 2. Google Gemini API
### Drafting Logic
- **Model**: `gemini-3-flash-preview`.
- **Input**: `{ name, category, notes, scores, user_portfolio_summary }`.
- **System Instruction**: "Act as a direct-to-point technical consultant. Focus on specific technical deficits. Avoid all marketing jargon. Use a helpful, non-salesy tone."

## 3. Google Places & PageSpeed
- **Places Text Search**: Used for the initial Discovery scan.
- **PageSpeed Insights API**: Called during the "Deep Audit" phase in the Review Queue. 
    - *Metric Focus*: LCP (Largest Contentful Paint) and Mobile Friendliness score.

## 4. Scraper Logic (External)
- **Input**: Lead URL.
- **Output**: 
    - Full page text (for Gemini analysis).
    - Screenshot (for UI/Review).
    - Tech stack fingerprints (React, WordPress, jQuery version, etc.).
- **Integration**: Scraper output is pushed to a Supabase Edge Function which then updates the `leads` table.