import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.8.0?target=deno&no-check";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
const priceStudio = Deno.env.get("STRIPE_PRICE_STUDIO")!;
const priceAgency = Deno.env.get("STRIPE_PRICE_AGENCY")!;
const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").replace(/\/$/, "");

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  global: { headers: { "x-client-info": "stripe-checkout-fn" } },
});

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

type Payload = {
  priceId?: string;
  planId?: string; // 'studio' | 'agency'
  successUrl?: string;
  cancelUrl?: string;
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return respondError("Method not allowed", 405);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return respondError("Missing Authorization token", 401);

    const { data: userResp } = await supabase.auth.getUser(token);
    const user = userResp?.user;
    if (!user) return respondError("Unauthorized", 401);

    const body = await req.json().catch(() => ({})) as Payload;
    const planId = (body.planId || "").toLowerCase();

    // Allow planId aliases; default to Studio if unspecified.
    let priceId = body.priceId || priceStudio;
    if (planId === "studio") priceId = priceStudio;
    if (planId === "agency" || planId === "agency+" || planId === "agency_plus" || planId === "agency_waitlist") {
      priceId = priceAgency;
      // Optional: enforce agency approval flag
      const { data: agencyProfile } = await supabase
        .from("profiles")
        .select("agency_approved")
        .eq("id", user.id)
        .maybeSingle();
      if (agencyProfile && agencyProfile.agency_approved === false) {
        return respondError("Agency+ requires approval before checkout.", 403);
      }
    }
    if (!priceId) return respondError("Missing priceId", 400);

    const successUrl = body.successUrl || `${appBaseUrl}/?billing=success`;
    const cancelUrl = body.cancelUrl || `${appBaseUrl}/?billing=cancel`;

    // Fetch or create Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, display_name")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: profile?.display_name || undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { user_id: user.id, plan_id: planId || "studio" },
      subscription_data: {
        metadata: { user_id: user.id, plan_id: planId || "studio" },
      },
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("checkout error", err);
    return respondError("Internal error", 500);
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "600",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function respondError(message: string, status = 400) {
  return json({ error: message }, status);
}
