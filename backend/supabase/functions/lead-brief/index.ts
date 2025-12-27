import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "600",
};

type LeadInput = {
  id?: string;
  name?: string;
  category?: string;
  rating?: number;
  website?: string | null;
  notes?: string | null;
};

type BriefResult = {
  whyNow: string[];
  talkingPoints: string[];
  opener: string;
  cta: string;
  signals: {
    rating: number | null;
    hasSSL: boolean;
    hasBooking: boolean;
    hasPixel: boolean;
    hasSchema: boolean;
    hasContact: boolean;
    perfMs: number | null;
    lastStatus?: number | null;
  };
};

const normalizeUrl = (raw?: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const parseSignals = (html: string) => {
  const lower = html.toLowerCase();
  const hasBooking =
    /\b(book|booking|schedule|appointment|reserve|consult)/i.test(html) ||
    /calendly\.com|oncehub|youcanbook\.me/.test(lower) ||
    /<form[^>]*(book|schedule|appointment)/i.test(html);
  const hasPixel =
    /gtag\(.+google-analytics\.com/i.test(lower) ||
    /googletagmanager\.com/i.test(lower) ||
    /connect\.facebook\.net\/en_US\/fbevents\.js/i.test(lower) ||
    /fbq\('init'/.test(lower);
  const hasSchema = /application\/ld\+json/i.test(html);
  const hasContact = /(tel:|mailto:|contact us|call us|visit us|map)/i.test(html);
  return { hasBooking, hasPixel, hasSchema, hasContact };
};

const buildBrief = (lead: LeadInput, signals: BriefResult["signals"]): BriefResult => {
  const whyNow: string[] = [];
  const talkingPoints: string[] = [];

  if (signals.rating !== null && signals.rating < 3.5) {
    whyNow.push("Rating is below 3.5 — reputation risk.");
    talkingPoints.push("Recent reviews suggest trust gaps; propose a 30-day recovery sprint.");
  }
  if (!signals.hasBooking) {
    whyNow.push("No booking/appointment flow detected.");
    talkingPoints.push("Add a booking CTA to capture ready-to-buy visitors.");
  }
  if (!signals.hasSSL) {
    whyNow.push("Site is not serving over HTTPS.");
    talkingPoints.push("Enable SSL to boost trust and avoid browser warnings.");
  }
  if (!signals.hasPixel) {
    talkingPoints.push("Add tracking (GA/Meta) to measure and retarget traffic.");
  }
  if (!signals.hasSchema) {
    talkingPoints.push("Add local schema (address/phone) to improve visibility.");
  }
  if (!signals.hasContact) {
    talkingPoints.push("Surface phone/email clearly to reduce drop-off.");
  }
  if (signals.perfMs && signals.perfMs > 2500) {
    whyNow.push("Page responded slowly; speed is leaking conversions.");
    talkingPoints.push("Tighten assets and hosting to improve first load.");
  }

  if (whyNow.length === 0) {
    whyNow.push("Quick wins available to lift conversions and trust.");
  }
  if (talkingPoints.length === 0) {
    talkingPoints.push("Tidy the hero, add a clear CTA, and tighten load time.");
  }

  const opener = `Saw ${lead.name || "your site"} — noticed ${whyNow[0].toLowerCase()} Let’s fix it with a quick, trackable win this week.`;
  const cta = signals.hasBooking
    ? "Want me to audit your booking flow and share 3 fixes?"
    : "Want a quick booking CTA + tracking live this week?";

  return { whyNow, talkingPoints: talkingPoints.slice(0, 4), opener, cta, signals };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const lead: LeadInput = body?.lead || {};
    const url = normalizeUrl(lead.website);

    const signals: BriefResult["signals"] = {
      rating: typeof lead.rating === "number" ? lead.rating : null,
      hasSSL: url ? url.startsWith("https://") : false,
      hasBooking: false,
      hasPixel: false,
      hasSchema: false,
      hasContact: false,
      perfMs: null,
      lastStatus: null,
    };

    if (url) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const started = Date.now();
        const res = await fetch(url, {
          redirect: "follow",
          headers: { "User-Agent": "GridLeadBrief/1.0 (+https://gridlead.space)" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const text = await res.text();
        signals.perfMs = Date.now() - started;
        signals.lastStatus = res.status;
        const parsed = parseSignals(text);
        signals.hasBooking = parsed.hasBooking;
        signals.hasPixel = parsed.hasPixel;
        signals.hasSchema = parsed.hasSchema;
        signals.hasContact = parsed.hasContact;
      } catch (_e) {
        // graceful degradation: keep defaults
      }
    }

    const brief = buildBrief(lead, signals);
    return new Response(JSON.stringify(brief), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("lead-brief error", err);
    return new Response(JSON.stringify({ error: "Failed to build brief" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
