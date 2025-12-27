# LLM-Assisted Audit Plan (Testing → Production)

## Goals
- Keep audits fast and cheap; reserve LLM only for paid tiers.
- Always return heuristics (HTML parsing + lightweight checks); layer LLM output as an optional “wow” summary.
- Stay predictable: hard caps, short prompts, and fallbacks.

## Providers
- **Local/dev:** Ollama on localhost (`llama3:8b` or lighter `llama3:instruct`/`phi3:mini`). No per-call cost; limited to your machine.  
  - Endpoint: `http://localhost:11434/api/chat`
  - Warm-up needed; first call can be slow.
- **Hosted/prod:** Groq Llama 3 8B (low-cost/free tier).  
  - Endpoint: `https://api.groq.com/openai/v1/chat/completions`
  - Env: `GROQ_API_KEY`, `LLM_MODEL=llama-3.1-8b-instant`, `LLM_PROVIDER=groq`.

## Plan Gating & Caps
- **Starter (free):** No LLM. Heuristics-only.
- **Studio ($25):** LLM allowed; cap to **10 LLM audits/month** and **3/day**. After cap, fall back to heuristics.
- **Agency ($49):** LLM allowed; cap to **40 LLM audits/month** and **10/day**. After cap, fall back to heuristics.
- **Per-call budget:** `max_tokens` ~100–150; prompt includes only distilled signals + tiny thumbnail. Timeouts + fallback to heuristics if slow/error/quota hit.

## Data sent to LLM (keep tiny)
- Distilled signals: hero text, CTA texts, form presence, trust/contact, analytics/SEO flags, speed-lite badge, palette, top heuristics issues.
- Optional thumbnail: 320px wide, low-quality JPEG/base64 (or skip if not available).
- No raw HTML; no PII.

## Runtime Behavior
- Always compute heuristics first and return them.
- If plan allows and under caps, fire LLM call; stream/attach summary when available.
- If LLM fails/slow or caps exceeded, return heuristics-only and show “Lite audit” badge.

## Rate Limiting & Accounting
- Track per-user counters: monthly + daily LLM calls. Store in DB (profiles/usage table) and enforce on the server before calling LLM.
- Hard-stop when over limit; do not “burst” beyond caps.
- Add per-IP short-term throttle for abuse (e.g., 10 LLM attempts per hour per IP) in production.

## Cost/Performance Notes
- Local Ollama: CPU-only is fine for dev; expect higher latency and resource use. Do not expose to users.
- Hosted Groq: low cost; with caps above, Studio/Agency usage stays inexpensive. Keep tokens short to control spend.

## Testing → Production Checklist
- [ ] Local: run Ollama, pull model, verify `api/chat` responds; ensure heuristics-only path works with LLM off.  
- [ ] Env: set `LLM_PROVIDER` (`none`/`ollama`/`groq`), `LLM_MODEL`, and API key if hosted.  
- [ ] Caps: seed usage counters and verify over-cap behavior falls back to heuristics.  
- [ ] Fallbacks: simulate LLM timeout/error; UI should still show heuristics and “Lite” badge.  
- [ ] Token budget: enforce max tokens and small payload in code.  
- [ ] Logging: log LLM calls (count + latency + errors) per user/plan; no sensitive content in logs.  
- [ ] Deployment: Starter plan tested with LLM disabled; Studio/Agency tested under caps; verify render/screenshot fallback doesn’t break when unavailable.
