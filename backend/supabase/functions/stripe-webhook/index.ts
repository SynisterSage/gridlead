import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.8.0?target=deno&no-check";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const priceStudio = Deno.env.get("STRIPE_PRICE_STUDIO")!;
const priceAgency = Deno.env.get("STRIPE_PRICE_AGENCY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  global: { headers: { "x-client-info": "stripe-webhook-fn" } },
});

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "600",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respondError("Method not allowed", 405);

  const sig = req.headers.get("stripe-signature");
  if (!sig) return respondError("Missing stripe-signature", 400);

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verify failed", err.message);
    return respondError(`Webhook Error: ${err.message}`, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;
        const userId = (session.metadata as any)?.user_id || (session.subscription && (await stripe.subscriptions.retrieve(session.subscription as string)).metadata?.user_id) || null;
        const priceId = session.amount_total && session.amount_total > 0
          ? (session?.lines?.data?.[0]?.price?.id || null)
          : (session?.metadata as any)?.price_id || null;
        const planIdMeta = (session.metadata as any)?.plan_id || null;
        await upsertProfile(userId, subscriptionId, customerId, priceId, planIdMeta, session);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata as any)?.user_id || null;
        const priceId = sub.items.data[0]?.price?.id || null;
        const planIdMeta = (sub.metadata as any)?.plan_id || null;
        await upsertProfile(userId, sub.id, sub.customer as string, priceId, planIdMeta, sub);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string | null;
        const customerId = invoice.customer as string | null;
        const priceId = invoice.lines?.data?.[0]?.price?.id || null;
        const planIdMeta = (invoice.metadata as any)?.plan_id || invoice.lines?.data?.[0]?.metadata?.plan_id || null;
        const userIdMeta = (invoice.metadata as any)?.user_id || null;
        if (subscriptionId) {
          await updateFromSubscription(subscriptionId, customerId, priceId, planIdMeta, userIdMeta);
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const subscriptionId = (pi.metadata as any)?.subscription_id || (pi as any).subscription || null;
        const customerId = pi.customer as string | null;
        const planIdMeta = (pi.metadata as any)?.plan_id || null;
        const userIdMeta = (pi.metadata as any)?.user_id || null;
        if (subscriptionId) {
          const priceId = (pi.metadata as any)?.price_id || null;
          await updateFromSubscription(subscriptionId, customerId, priceId, planIdMeta, userIdMeta);
        }
        break;
      }
      default:
        // ignore others
        break;
    }
  } catch (err) {
    console.error("Webhook handler error", err);
    return respondError("Webhook handler error", 500);
  }

  return json({ received: true });
});

async function upsertProfile(
  userId: string | null,
  subscriptionId: string | null,
  customerId: string | null,
  priceId: string | null,
  planIdMeta: string | null,
  src: Stripe.Checkout.Session | Stripe.Subscription,
) {
  if (!userId) return;
  const plan = mapPriceToPlan(priceId) || mapPlanId(planIdMeta);
  const planStatus = deriveStatus(src);
  const currentPeriodEnd = getPeriodEnd(src);
  const cancelAtPeriodEnd = getCancelAtPeriodEnd(src);

  await supabase
    .from("profiles")
    .update({
      stripe_customer_id: customerId || null,
      stripe_subscription_id: subscriptionId || null,
      plan,
      plan_status: planStatus,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
    })
    .eq("id", userId);
}

function mapPriceToPlan(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  if (priceId === priceStudio) return "studio";
  if (priceId === priceAgency) return "agency_waitlist";
  return null;
}

async function updateFromSubscription(
  subscriptionId: string,
  customerId: string | null,
  priceIdMeta?: string | null,
  planIdMeta?: string | null,
  userIdMeta?: string | null,
) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = userIdMeta || (sub.metadata as any)?.user_id || null;
  const priceId = priceIdMeta || sub.items.data[0]?.price?.id || null;
  await upsertProfile(userId, sub.id, customerId || (sub.customer as string), priceId, planIdMeta || (sub.metadata as any)?.plan_id || null, sub);
}

function mapPlanId(planId: string | null | undefined): string | null {
  if (!planId) return null;
  const p = planId.toLowerCase();
  if (p.includes("studio")) return "studio";
  if (p.includes("agency")) return "agency_waitlist";
  if (p.includes("starter") || p.includes("free")) return "starter";
  return null;
}

function deriveStatus(src: Stripe.Checkout.Session | Stripe.Subscription): string {
  if ("status" in src && src.status) {
    // Map Stripe subscription statuses to our plan_status field
    if (src.status === "active") return "active";
    if (src.status === "trialing") return "active";
    if (src.status === "canceled") return "canceled";
    if (src.status === "incomplete" || src.status === "incomplete_expired" || src.status === "past_due" || src.status === "unpaid") return src.status;
    return src.status;
  }
  return "active";
}

function getPeriodEnd(src: Stripe.Checkout.Session | Stripe.Subscription): string | null {
  if ("current_period_end" in src && src.current_period_end) {
    return new Date(src.current_period_end * 1000).toISOString();
  }
  return null;
}

function getCancelAtPeriodEnd(src: Stripe.Checkout.Session | Stripe.Subscription): boolean {
  if ("cancel_at_period_end" in src) return !!src.cancel_at_period_end;
  return false;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function respondError(message: string, status = 400) {
  return json({ error: message }, status);
}
