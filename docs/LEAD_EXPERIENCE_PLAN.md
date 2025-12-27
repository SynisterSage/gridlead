# Lead Experience Plan (High-WOW, Low-Cost)

## Target Users
- Local services + niche vertical agencies (roofing, HVAC, med spa, legal, restaurants) running outbound for site/ads/reputation work.
- Small agency teams (1–5) and fractional marketers who need “lead + brief + outreach” in one flow.
- (Later) outbound teams needing tech/firmographic signals once we add more enrichment.

## Lead Types We Support First
- Local service SMBs via Google Places + light web/review scrape.
- Signals we can get free: offer/CTA/booking presence, SSL, viewport/mobile, basic perf timing, pixels/schema, review rating/count/complaints, change hashes (site/reviews), tech regex (WP/Shopify/Wix/GA/Meta pixels).

## Hero Flow to Ship
Lead Brief Cards (per lead):
- Why now: key deficits (no booking, low rating, slow/mobile-poor, no SSL, pixel-no-offer).
- Talking points (3 bullets) grounded in scraped/review data.
- Tailored opener + CTA suggestion.
- Auto-tag with playbook(s): Review SOS, Booking Leak, Speed/Mobile Pain, Pixel-No-Offer.

## Core Features (Phase 1)
- Saved Searches + Nightly Refresh: user saves ICP (niche/geo/min rating); nightly discover → dedupe → tag new → notify.
- Playbooks:
  - Review SOS: rating <3.5 or complaints spike; complaint summary + 30-day recovery checklist + opener.
  - Booking Leak: no booking link/form; “lost revenue” angle + 3 fixes + opener.
  - Speed/Mobile Pain: perf/mobile issues; 3 fixes + opener; optional $ impact calc.
- Signal Alerts (push/in-app): review change (rating/count), SSL flip, pixel/tech change, perf degradation, site hash change.
- Inbox intelligence (cheap): reply classification (interested/pricing/not-now/wrong-contact) via heuristics or optional AI key.

## Data/Tech Notes
- Stay on Supabase + Places. Add lightweight HTML/review fetch in Edge Functions for signals; hash for change detection.
- Reuse existing audit function for perf/mobile; extend to extract offer/CTA/booking/pixels/schema.
- No site previews; wow comes from insight + tailored openers + alerts.

## Demo Story
1) Save a search (e.g., “HVAC, Dallas, rating >= 3.0”). Nightly refresh stages new leads.
2) Open a lead → Brief Card shows Why Now + opener + playbook tags.
3) Apply Review SOS or Booking Leak; one-click outreach inserts the tailored opener.
4) Alerts fire when reviews or site signals change; inbox triage suggests next step.

## Next (Phase 2, optional)
- Tech/firmographic enrichment for e-comm/SMB SaaS (when budget allows).
- Territory/team routing, shared pools, “next best lead” ordering.
- More signals: hiring/job-posting scrape, ad presence hints.
