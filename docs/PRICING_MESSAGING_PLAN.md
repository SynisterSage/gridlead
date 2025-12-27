# Pricing Messaging Plan (Hold for Implementation)

Intent: Refresh LandingPage pricing copy after we ship Signals/Playbooks. Keep aligned with plan limits and future LLM gating; don’t change UI until ready.

## Per-Tier Messaging
- Starter (Free)
  - “Saved searches + nightly refresh (50 leads/mo), basic briefs from signals, 2 sender seats, light audits, inbox triage lite.”
  - No LLM/Gemini; heuristics-only.
  - CTA: “Start with signals.”
- Studio ($25)
  - “1,000 leads/mo, 5 seats + rotation, deep briefs with signals, Review SOS & Booking Leak playbooks, signal alerts (reviews/SSL/tech/perf), reply classification, priority support.”
  - LLM/Gemini allowed later with caps; keep copy future-proof: “LLM-assisted audits (capped) coming to Studio.”
  - CTA: “Run playbooks.”
- Agency+ (Waitlist)
  - “Unlimited leads/seats, AI playbooks & auto-sequencing, advanced deliverability, richer signals (tech tags), LLM-assisted audits when enabled, domain pools, dedicated success.”
  - CTA: “Join waitlist.”

## Header/Ribbon Ideas
- Replace/augment chips with: “Signals + Briefs” and “Playbook-ready alerts” (swap out “Proof-first outreach” if desired).
- Add a mini compare row below cards: Leads/mo, Seats, Signals/Alerts, Playbooks, LLM audits (future).
- Footnote/tooltip: “LLM-assisted audits in roadmap; Starter stays heuristics-only.”

## Limits & Transparency (copy hooks)
- “Lead quotas reset monthly.”
- “Alerts included on Studio+.”
- “LLM audits (when live): Studio capped (10/mo, 3/day), Agency higher (40/mo, 10/day); Starter none.”

## Implementation Notes (when we do it)
- Update card bullets in `LandingPage.tsx` to the above.
- Add compare row with 3–4 bullets only (keep layout clean).
- Keep CTAs tier-specific as noted.
