import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.8.0?target=deno&no-check";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").replace(/\/$/, "");

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  global: { headers: { "x-client-info": "stripe-portal-fn" } },
});

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

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

    const returnUrl = `${appBaseUrl}/?billing=portal`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("portal error", err);
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
