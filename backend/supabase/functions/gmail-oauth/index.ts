import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type PlanTier = "starter" | "studio" | "agency_waitlist";

interface PlanLimits {
  leadLimit: number | null;
  senderLimit: number | null;
  auditDepth: "light" | "deep" | "full";
  canUseGemini: boolean;
  label: string;
  description: string;
}

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: {
    leadLimit: 50,
    senderLimit: 2,
    auditDepth: "light",
    canUseGemini: false,
    label: "Starter",
    description: "Free tier with light audits and 2 sender seats.",
  },
  studio: {
    leadLimit: 1000,
    senderLimit: 5,
    auditDepth: "deep",
    canUseGemini: true,
    label: "Studio",
    description: "Paid tier with deep audits, rotation, and AI outreach.",
  },
  agency_waitlist: {
    leadLimit: null,
    senderLimit: null,
    auditDepth: "full",
    canUseGemini: true,
    label: "Agency+",
    description: "In-development tier; treat as unlimited once activated.",
  },
};

const getPlanLimits = (plan?: string | null): PlanLimits => {
  if (!plan) return PLAN_LIMITS.starter;
  const normalized = plan.toLowerCase() as PlanTier;
  return PLAN_LIMITS[normalized] ?? PLAN_LIMITS.starter;
};

const isOverSenderLimit = (plan: string | null | undefined, seatsUsed: number): boolean => {
  const { senderLimit } = getPlanLimits(plan);
  return senderLimit !== null && seatsUsed >= senderLimit;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const clientId = Deno.env.get("GMAIL_OAUTH_CLIENT_ID")!;
const clientSecret = Deno.env.get("GMAIL_OAUTH_CLIENT_SECRET")!;
const redirectUriRaw = Deno.env.get("GMAIL_OAUTH_REDIRECT_URI")!;
const redirectUri = redirectUriRaw.replace(/\/$/, ""); // normalize trailing slash
const appRedirect = Deno.env.get("APP_REDIRECT_URL") || "/";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  global: { headers: { "x-client-info": "gmail-oauth-fn" } },
});

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) return new Response("Missing code", { status: 400 });
    if (!state) return new Response("Missing state (user_id)", { status: 400 });
    const userId = state;

    // Exchange code for tokens
    console.log("gmail-oauth: exchange start", { clientId, redirectUri, state });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", { status: tokenRes.status, err });
      return new Response("Token exchange failed", { status: 500 });
    }

    const tokenJson = await tokenRes.json();
    const { refresh_token, access_token, expires_in, id_token } = tokenJson;
    const expiry = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    let email = parseEmailFromIdToken(id_token);
    let avatarUrl: string | null = null;
    // Try to grab avatar from id_token if present
    if (id_token) {
      try {
        const payload = JSON.parse(atob(id_token.split(".")[1] || ""));
        avatarUrl = payload?.picture || null;
      } catch (_e) {
        // ignore decode errors
      }
    }
    // Fallback: fetch userinfo if email missing
    if (access_token && (!email || !avatarUrl)) {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (userInfoRes.ok) {
        const userJson = await userInfoRes.json();
        email = email || userJson?.email;
        avatarUrl = avatarUrl || userJson?.picture || null;
      }
    }
    // Additional fallback for some providers/responses
    if (!email && access_token) {
      const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${access_token}`);
      if (tokenInfoRes.ok) {
        const tokenInfo = await tokenInfoRes.json();
        email = tokenInfo?.email || email;
      }
    }

    if (!email) return new Response("No email in token", { status: 400 });

    // Ensure profile exists and fetch plan/seats
    let plan = "starter";
    let senderSeatsUsed = 0;
    const { data: profileRow, error: profileFetchError } = await supabase
      .from("profiles")
      .select("id, plan, sender_seats_used")
      .eq("id", userId)
      .maybeSingle();
    if (profileFetchError) return respondError("Fetch profile error", profileFetchError);

    if (!profileRow) {
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({ id: userId, gmail_connected: true });
      if (profileInsertError) return respondError("Create profile error", profileInsertError);
    } else {
      plan = profileRow.plan || "starter";
      senderSeatsUsed = profileRow.sender_seats_used ?? 0;
    }

    // Find or create gmail_account for this user/email
    let accountId: string | null = null;
    const { data: existingAccount, error: findError } = await supabase
      .from("gmail_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("email", email)
      .maybeSingle();

    if (findError) return respondError("Find account error", findError);

    if (existingAccount?.id) {
      accountId = existingAccount.id;
      const { error: updateAccountError } = await supabase
        .from("gmail_accounts")
        .update({
          status: "connected",
          avatar_url: avatarUrl,
          scopes: [
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.readonly",
          ],
        })
        .eq("id", accountId);
      if (updateAccountError) return respondError("Update account error", updateAccountError);
    } else {
      if (isOverSenderLimit(plan, senderSeatsUsed)) {
        const upgradeUrl = new URL(appRedirect);
        upgradeUrl.searchParams.set("error", "sender_limit");
        upgradeUrl.searchParams.set("plan", getPlanLimits(plan).label);
        return Response.redirect(upgradeUrl.toString(), 302);
      }
      const { data: insertAccount, error: insertAccountError } = await supabase
        .from("gmail_accounts")
        .insert({
          user_id: userId,
          email,
          status: "connected",
          avatar_url: avatarUrl,
          scopes: [
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.readonly",
          ],
        })
        .select("id")
        .single();
      if (insertAccountError) return respondError("Insert account error", insertAccountError);
      accountId = insertAccount.id;
    }

    // Ensure a primary account exists; set the newly connected account if none
    const { data: primaryAccount, error: primaryErr } = await supabase
      .from("gmail_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle();

    if (!primaryErr && !primaryAccount && accountId) {
      await supabase
        .from("gmail_accounts")
        .update({ is_primary: true })
        .eq("id", accountId);
    }

    // Keep existing refresh token if Google didn't return one
    let refreshToStore = refresh_token;
    if (!refreshToStore) {
      const { data: existingCred } = await supabase
        .from("gmail_credentials")
        .select("refresh_token")
        .eq("id", accountId)
        .maybeSingle();
      if (existingCred?.refresh_token) {
        refreshToStore = existingCred.refresh_token;
      }
    }

    const { error: credError } = await supabase
      .from("gmail_credentials")
      .upsert({
        id: accountId,
        refresh_token: refreshToStore,
        access_token,
        expiry,
        provider: "google",
      });
    if (credError) return respondError("Upsert credentials error", credError);

    await supabase.from("profiles").update({ gmail_connected: true }).eq("id", userId);

    const redirectUrl = new URL(appRedirect);
    redirectUrl.searchParams.set("gmail", "1");
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (err) {
    console.error(err);
    return respondError("Internal error", err);
  }
});

function parseEmailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const payload = JSON.parse(atob(parts[1]));
  return payload?.email || null;
}

function respondError(message: string, err: any) {
  console.error(message, err);
  const details = typeof err === "string" ? err : err?.message || err?.details || "";
  return new Response(JSON.stringify({ error: message, details }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
