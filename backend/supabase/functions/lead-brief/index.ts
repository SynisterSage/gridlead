import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
  reviews_count?: number | null;
  website?: string | null;
  notes?: string | null;
};

type BriefResult = {
  whyNow: string[];
  talkingPoints: string[];
  opener: string;
  cta: string;
  evidence: string[];
  signals: {
    rating: number | null;
    reviewsCount?: number | null;
    hasSSL: boolean;
    hasBooking: boolean;
    hasForm: boolean;
    ctaText: string | null;
    hasPixel: boolean;
    hasSchema: boolean;
    hasContact: boolean;
    hasMap: boolean;
    perfMs: number | null;
    statusCode: number | null;
    lastStatus?: number | null;
    auditScore?: {
      design?: number | null;
      performance?: number | null;
      trust?: number | null;
      reviews?: number | null;
    };
    auditChecklist?: {
      mobileOptimization?: boolean | null;
      sslCertificate?: boolean | null;
      seoPresence?: boolean | null;
      conversionFlow?: boolean | null;
      hasGoogleReviews?: boolean | null;
      hasRender?: boolean | null;
    };
  };
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = supabaseUrl && supabaseServiceRole
  ? createClient(supabaseUrl, supabaseServiceRole, { global: { headers: { "x-client-info": "lead-brief-fn" } } })
  : null;

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
  const hasMap = /google\.com\/maps|<iframe[^>]+maps/i.test(lower);
  const hasForm = /<form[\s>]/i.test(html);
  const ctaMatch = html.match(/<(button|a)[^>]*>([^<]{4,60})<\/(button|a)>/i);
  const ctaText = ctaMatch ? ctaMatch[2].trim().replace(/\s+/g, " ") : null;
  return { hasBooking, hasPixel, hasSchema, hasContact, hasMap, hasForm, ctaText };
};

const buildBrief = (lead: LeadInput, signals: BriefResult["signals"]): BriefResult => {
  const whyNow: string[] = [];
  const talkingPoints: string[] = [];
  const evidence: string[] = [];

  if (signals.rating !== null && signals.rating < 3.5) {
    whyNow.push("Rating is below 3.5 — reputation risk.");
    if (signals.reviewsCount) {
      evidence.push(`Rating ${signals.rating} from ${signals.reviewsCount} reviews`);
    } else {
      evidence.push(`Rating ${signals.rating}`);
    }
    talkingPoints.push("Recent reviews suggest trust gaps; propose a 30-day recovery sprint.");
  }
  if (!signals.hasBooking) {
    whyNow.push("No booking/appointment flow detected.");
    evidence.push("No booking CTA or scheduler found");
    talkingPoints.push("Add a booking CTA to capture ready-to-buy visitors.");
  }
  if (!signals.hasSSL) {
    whyNow.push("Site is not serving over HTTPS.");
    evidence.push("Site appears to load without HTTPS");
    talkingPoints.push("Enable SSL to boost trust and avoid browser warnings.");
  }
  if (!signals.hasPixel) {
    evidence.push("No GA/Meta pixel detected");
    talkingPoints.push("Add tracking (GA/Meta) to measure and retarget traffic.");
  }
  if (!signals.hasSchema) {
    evidence.push("No schema markup detected");
    talkingPoints.push("Add local schema (address/phone) to improve visibility.");
  }
  if (!signals.hasContact) {
    evidence.push("Contact details not clearly found");
    talkingPoints.push("Surface phone/email clearly to reduce drop-off.");
  }
  if (signals.perfMs && signals.perfMs > 2500) {
    whyNow.push("Page responded slowly; speed is leaking conversions.");
    evidence.push(`Fetch latency ~${signals.perfMs}ms`);
    talkingPoints.push("Tighten assets and hosting to improve first load.");
  }
  if (signals.statusCode && signals.statusCode >= 400) {
    whyNow.push(`Site returned ${signals.statusCode}`);
    evidence.push(`HTTP status ${signals.statusCode}`);
    talkingPoints.push("Check hosting/SSL setup to ensure the site is reachable.");
  }
  if (signals.auditScore?.performance && (signals.auditScore.performance < 60)) {
    whyNow.push("Performance score is low.");
    evidence.push(`Audit performance score ${signals.auditScore.performance}`);
  }
  if (signals.auditChecklist?.mobileOptimization === false) {
    evidence.push("Audit: mobile optimization missing");
  }
  if (signals.auditChecklist?.conversionFlow === false) {
    evidence.push("Audit: conversion/contact flow weak");
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

  return { whyNow, talkingPoints: talkingPoints.slice(0, 4), opener, cta, evidence: evidence.slice(0, 5), signals };
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
      reviewsCount: typeof lead.reviews_count === "number" ? lead.reviews_count : null,
      hasSSL: url ? url.startsWith("https://") : false,
      hasBooking: false,
      hasForm: false,
      ctaText: null,
      hasPixel: false,
      hasSchema: false,
      hasContact: false,
      hasMap: false,
      perfMs: null,
      statusCode: null,
      lastStatus: null,
    };
    // If possible, hydrate from stored lead row (scores/checklist/notes) for richer context
    if (supabase && lead.id) {
      try {
        const { data: stored, error } = await supabase
          .from("leads")
          .select("score_design, score_performance, score_reviews, score_trust, checklist_mobile_optimization, checklist_ssl_certificate, checklist_seo_presence, checklist_conversion_flow, checklist_google_reviews, checklist_render, rating, notes, website")
          .eq("id", lead.id)
          .maybeSingle();
        if (!error && stored) {
          signals.rating = stored.rating ?? signals.rating;
          signals.auditScore = {
            design: stored.score_design ?? null,
            performance: stored.score_performance ?? null,
            reviews: stored.score_reviews ?? null,
            trust: stored.score_trust ?? null,
          };
          signals.auditChecklist = {
            mobileOptimization: stored.checklist_mobile_optimization ?? null,
            sslCertificate: stored.checklist_ssl_certificate ?? null,
            seoPresence: stored.checklist_seo_presence ?? null,
            conversionFlow: stored.checklist_conversion_flow ?? null,
            hasGoogleReviews: stored.checklist_google_reviews ?? null,
            hasRender: stored.checklist_render ?? null,
          };
          // If no url passed but row has one, use it
          if (!url && stored.website) {
            const normalized = normalizeUrl(stored.website);
            if (normalized) {
              lead.website = normalized;
            }
          }
        }
      } catch (_e) {
        // ignore
      }
    }

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
        signals.statusCode = res.status;
        const parsed = parseSignals(text);
        signals.hasBooking = parsed.hasBooking;
        signals.hasForm = parsed.hasForm;
        signals.ctaText = parsed.ctaText;
        signals.hasPixel = parsed.hasPixel;
        signals.hasSchema = parsed.hasSchema;
        signals.hasContact = parsed.hasContact;
        signals.hasMap = parsed.hasMap;
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
