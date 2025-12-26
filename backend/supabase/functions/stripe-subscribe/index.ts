import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.8.0?target=deno&no-check";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
const priceStudio = Deno.env.get("STRIPE_PRICE_STUDIO")!;
const priceAgency = Deno.env.get("STRIPE_PRICE_AGENCY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  global: { headers: { "x-client-info": "stripe-subscribe-fn" } },
});

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

type Payload = {
  planId?: string; // 'studio' | 'agency'
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
    const planId = (body.planId || "studio").toLowerCase();

    let priceId = priceStudio;
    if (planId.includes("agency")) {
      priceId = priceAgency;
      const { data: agencyProfile } = await supabase
        .from("profiles")
        .select("agency_approved, agency_waitlist_status")
        .eq("id", user.id)
        .maybeSingle();
      const approved =
        agencyProfile?.agency_approved === true ||
        (agencyProfile?.agency_waitlist_status || "").toLowerCase() === "approved";
      if (!approved) {
        return respondError("Agency+ requires approval before checkout.", 403);
      }
    }

    // Ensure customer exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, display_name, stripe_subscription_id")
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

    const existingSubId = profile?.stripe_subscription_id || null;
    let subscription: Stripe.Subscription | null = null;

    if (existingSubId) {
      const existing = await stripe.subscriptions.retrieve(existingSubId, { expand: ["items.data"] });
      const activeItem = existing.items.data[0];
      // Update the existing subscription to the new price to avoid double billing
      subscription = await stripe.subscriptions.update(existing.id, {
        customer: customerId || undefined,
        items: [{ id: activeItem?.id, price: priceId }],
        payment_behavior: "default_incomplete",
        proration_behavior: "create_prorations",
        payment_settings: { save_default_payment_method: "on_subscription" },
        metadata: { user_id: user.id, plan_id: planId },
        expand: ["latest_invoice.payment_intent"],
      });
    } else {
      // Create subscription in incomplete state to collect payment via Payment Element
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        metadata: { user_id: user.id, plan_id: planId },
        expand: ["latest_invoice.payment_intent"],
      });
      await supabase.from("profiles").update({ stripe_subscription_id: subscription.id }).eq("id", user.id);
    }

    const clientSecret = (subscription.latest_invoice as any)?.payment_intent?.client_secret || null;
    if (!clientSecret) {
      return respondError("Unable to create payment intent", 500);
    }

    return json({ clientSecret, subscriptionId: subscription.id });
  } catch (err) {
    console.error("stripe-subscribe error", err);
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
