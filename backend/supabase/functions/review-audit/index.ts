import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const pageSpeedKey = Deno.env.get("PAGESPEED_API_KEY") || "";
const placesApiKey = Deno.env.get("PLACES_API_KEY") || "";
const renderUrl = Deno.env.get("RENDER_URL") || "";
const renderAuth = Deno.env.get("RENDER_AUTH_TOKEN") || "";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "600",
};

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  global: { headers: { "x-client-info": "review-audit-fn" } },
});

interface AuditRequest {
  url: string;
  leadId?: string;
  placeId?: string;
}

interface AuditResponse {
  scores: {
    design: number;
    performance: number;
    reviews: number;
    trust: number;
  };
  checklist: {
    mobileOptimization: boolean;
    sslCertificate: boolean;
    seoPresence: boolean;
    conversionFlow: boolean;
    hasGoogleReviews?: boolean;
    hasRender?: boolean;
  };
  summary: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as AuditRequest;
    if (!body?.url) return respondError("Missing URL", 400);

    const normalizedUrl = normalizeUrl(body.url);
    const { scores, checklist, summary } = await runAudit(normalizedUrl, body.placeId);

    if (body.leadId) {
      await supabase
        .from("leads")
        .update({
          score_design: scores.design,
          score_performance: scores.performance,
          score_reviews: scores.reviews,
          score_trust: scores.trust,
          notes: summary,
          checklist_mobile_optimization: checklist.mobileOptimization,
          checklist_ssl_certificate: checklist.sslCertificate,
          checklist_seo_presence: checklist.seoPresence,
          checklist_conversion_flow: checklist.conversionFlow,
          checklist_google_reviews: checklist.hasGoogleReviews ?? null,
          checklist_render: checklist.hasRender ?? null,
        })
        .eq("id", body.leadId);
    }

    const response: AuditResponse = { scores, checklist, summary };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Audit error", err);
    return respondError("Internal error", 500);
  }
});

function normalizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

async function runAudit(url: string, placeId?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  let html = "";
  let finalUrl = url;
  let sslCertificate = url.startsWith("https://");
  let responseTimeMs = 0;
  let contentLength = 0;

  try {
    const start = Date.now();
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    responseTimeMs = Date.now() - start;
    finalUrl = res.url || url;
    sslCertificate = finalUrl.startsWith("https://");
    contentLength = Number(res.headers.get("content-length") || "0");
    html = await res.text();
  } catch (_e) {
    // fall back to empty html
  } finally {
    clearTimeout(timeout);
  }

  // Optional rendered HTML/screenshot via Render proxy (with timeout)
  let renderedHtml: string | null = null;
  let renderAttempted = false;
  let renderOk = false;
  if (renderUrl && renderAuth) {
    renderAttempted = true;
    const renderCtrl = new AbortController();
    const renderTimeout = setTimeout(() => renderCtrl.abort(), 15000);
    try {
      const renderResp = await fetch(renderUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-render-auth": renderAuth,
        },
        body: JSON.stringify({ url: finalUrl, mobile: true }),
        signal: renderCtrl.signal,
      });
      if (renderResp.ok) {
        renderOk = true;
        const renderJson = await renderResp.json();
        if (renderJson?.html) renderedHtml = renderJson.html as string;
      }
    } catch (_e) {
      // ignore render failures; keep HTML fallback
    } finally {
      clearTimeout(renderTimeout);
    }
  }

  const parsed = parseHtml(html);
  const renderedParsed = renderedHtml ? parseHtml(renderedHtml) : null;

  // Optional: fetch reviews data from Places Details if placeId provided
  let reviewsScore: number | null = null;
  let reviewsCount: number | null = null;
  if (placeId) {
    const details = await fetchPlaceDetails(placeId);
    if (details) {
      reviewsScore = typeof details.rating === "number" ? details.rating : null;
      reviewsCount = typeof details.userRatingCount === "number" ? details.userRatingCount : null;
    }
  }

  const psiScore = await getPageSpeedScore(finalUrl);
  const performance = computePerformance(psiScore, responseTimeMs, contentLength);
  const design = computeDesign(renderedParsed || parsed);
  const reviews = computeReviews(parsed, reviewsScore, reviewsCount);
  const trust = computeTrust(renderedParsed || parsed, sslCertificate, reviewsScore, reviewsCount);

  const checklist = {
    mobileOptimization: parsed.hasViewport,
    sslCertificate,
    seoPresence: parsed.hasTitle || parsed.hasMetaDescription || parsed.hasCanonical || parsed.hasSchema,
    conversionFlow: parsed.hasContactInfo,
    hasGoogleReviews: !!reviewsScore || !!reviewsCount,
    hasRender: renderOk,
  };

  const summary = buildSummary({
    performance,
    design,
    reviews,
    trust,
    parsed,
    renderAttempted,
    renderOk,
    rendered: renderedParsed,
    psiScore,
    responseTimeMs,
    sslCertificate,
    reviewsScore,
    reviewsCount,
  });

  return {
    scores: {
      design,
      performance,
      reviews,
      trust,
    },
    checklist,
    summary,
  };
}

function parseHtml(html: string) {
  const lower = html.toLowerCase();
  const getMeta = (name: string) => {
    const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
    const match = html.match(regex);
    return match?.[1] || "";
  };

  const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(lower);
  const hasTitle = /<title>[^<]{10,}/i.test(html);
  const hasMetaDescription = !!getMeta("description");
  const hasCanonical = /<link[^>]*rel=["']canonical["'][^>]*>/i.test(lower);
  const hasOpenGraph = /property=["']og:/i.test(lower);
  const hasTwitter = /name=["']twitter:/i.test(lower);
  const hasSchema = /application\/ld\+json/i.test(lower);
  const h1Count = (html.match(/<h1/gi) || []).length;
  const hasContactInfo = /mailto:|tel:|contact|quote|book|appointment|schedule|get started/i.test(lower);
  const hasSocial = /facebook\.com|instagram\.com|linkedin\.com|twitter\.com|tiktok\.com/i.test(lower);
  const hasReviewLinks = /yelp\.com|trustpilot\.com|google\.[^/]+\/maps/i.test(lower);

  return {
    hasViewport,
    hasTitle,
    hasMetaDescription,
    hasCanonical,
    hasOpenGraph,
    hasTwitter,
    hasSchema,
    h1Count,
    hasContactInfo,
    hasSocial,
    hasReviewLinks,
  };
}

function computeDesign(parsed: ReturnType<typeof parseHtml>) {
  let score = 50;
  if (parsed.hasViewport) score += 10;
  if (parsed.hasOpenGraph) score += 5;
  if (parsed.hasTwitter) score += 5;
  if (parsed.hasSchema) score += 5;
  if (parsed.hasTitle) score += 5;
  if (parsed.hasMetaDescription) score += 5;
  if (parsed.h1Count >= 1) score += 5;
  return clamp(score);
}

function computePerformance(psiScore: number | null, responseTime: number, sizeBytes: number) {
  if (psiScore !== null) return clamp(Math.round(psiScore * 100));
  let score = 50;
  if (responseTime > 2000) score -= 15;
  else if (responseTime > 1000) score -= 5;
  if (sizeBytes > 1_000_000) score -= 10;
  return clamp(score);
}

function computeReviews(parsed: ReturnType<typeof parseHtml>, rating: number | null, reviewCount: number | null) {
  let score = 50;
  if (rating !== null) {
    if (rating >= 4.5) score += 18;
    else if (rating >= 4.0) score += 12;
    else if (rating >= 3.5) score += 6;
    else if (rating < 3.0) score -= 12;
  } else if (parsed.hasReviewLinks) {
    score += 5;
  }

  if (reviewCount !== null) {
    if (reviewCount >= 200) score += 10;
    else if (reviewCount >= 50) score += 6;
    else if (reviewCount >= 10) score += 3;
  }

  return clamp(score);
}

function computeTrust(parsed: ReturnType<typeof parseHtml>, ssl: boolean, rating: number | null, reviewCount: number | null) {
  let score = 50;
  if (ssl) score += 15;
  if (parsed.hasContactInfo) score += 10;
  if (parsed.hasSocial) score += 10;
  if (parsed.hasReviewLinks) score += 10;
  if (rating !== null) {
    if (rating >= 4.2) score += 8;
    else if (rating < 3.0) score -= 10;
  }
  if (reviewCount !== null && reviewCount >= 50) score += 5;
  return clamp(score);
}

function clamp(n: number) {
  return Math.max(5, Math.min(100, n));
}

async function getPageSpeedScore(url: string): Promise<number | null> {
  if (!pageSpeedKey) return null;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  try {
    const apiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    apiUrl.searchParams.set("url", url);
    apiUrl.searchParams.set("category", "PERFORMANCE");
    apiUrl.searchParams.set("strategy", "MOBILE");
    apiUrl.searchParams.set("key", pageSpeedKey);
    const res = await fetch(apiUrl.toString(), { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const score = data?.lighthouseResult?.categories?.performance?.score;
    if (typeof score === "number") return score;
    return null;
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPlaceDetails(placeId: string) {
  if (!placesApiKey) return null;
  try {
    const endpoint = `https://places.googleapis.com/v1/places/${placeId}`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": placesApiKey,
        "X-Goog-FieldMask": "rating,userRatingCount",
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      rating: json?.rating ?? null,
      userRatingCount: json?.userRatingCount ?? null,
    };
  } catch (_e) {
    return null;
  }
}

function buildSummary(args: {
  performance: number;
  design: number;
  reviews: number;
  trust: number;
  parsed: ReturnType<typeof parseHtml>;
  renderAttempted: boolean;
  renderOk: boolean;
  rendered: ReturnType<typeof parseHtml> | null;
  psiScore: number | null;
  responseTimeMs: number;
  sslCertificate: boolean;
  reviewsScore: number | null;
  reviewsCount: number | null;
}) {
  const items: string[] = [];
  if (args.psiScore !== null) {
    items.push(`Performance: ${Math.round(args.psiScore * 100)}/100 (PageSpeed mobile)`);
  } else {
    items.push(`Performance: approx ${args.performance}/100 (probe)`);
  }
  items.push(args.sslCertificate ? "SSL detected" : "No SSL detected");
  if (args.reviewsScore !== null) {
    items.push(`Google rating ${args.reviewsScore.toFixed(1)} (${args.reviewsCount ?? 0} reviews)`);
  }
  if (args.renderAttempted && args.renderOk) items.push("Render OK (mobile viewport)");
  if (!args.parsed.hasViewport) items.push("No mobile viewport tag detected");
  if (!args.parsed.hasMetaDescription) items.push("Missing meta description");
  if (!args.parsed.hasSchema) items.push("No structured data found");
  if (!args.parsed.hasContactInfo) items.push("No clear contact/CTA found");
  return items.slice(0, 4).join(" • ");
}

function respondError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
