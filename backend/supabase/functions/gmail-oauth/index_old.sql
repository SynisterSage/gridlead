import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const clientId = Deno.env.get("GMAIL_OAUTH_CLIENT_ID")!;
const clientSecret = Deno.env.get("GMAIL_OAUTH_CLIENT_SECRET")!;
const redirectUri = Deno.env.get("GMAIL_OAUTH_REDIRECT_URI")!;
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
      console.error("Token exchange failed:", err);
      return new Response("Token exchange failed", { status: 500 });
    }

    const tokenJson = await tokenRes.json();
    const { refresh_token, access_token, expires_in, id_token } = tokenJson;
    const expiry = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    const email = parseEmailFromIdToken(id_token);
    if (!email) return new Response("No email in token", { status: 400 });

    // Find or create gmail_account for this user/email
    let accountId: string | null = null;
    const { data: existingAccount, error: findError } = await supabase
      .from("gmail_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("email", email)
      .maybeSingle();

    if (findError) {
      console.error("Find account error:", findError);
      return new Response("DB error", { status: 500 });
    }

    if (existingAccount?.id) {
      accountId = existingAccount.id;
      const { error: updateAccountError } = await supabase
        .from("gmail_accounts")
        .update({
          status: "connected",
          scopes: [
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.readonly",
          ],
        })
        .eq("id", accountId);
      if (updateAccountError) {
        console.error("Update account error:", updateAccountError);
        return new Response("DB error", { status: 500 });
      }
    } else {
      const { data: insertAccount, error: insertAccountError } = await supabase
        .from("gmail_accounts")
        .insert({
          user_id: userId,
          email,
          status: "connected",
          scopes: [
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.readonly",
          ],
        })
        .select("id")
        .single();
      if (insertAccountError) {
        console.error("Insert account error:", insertAccountError);
        return new Response("DB error", { status: 500 });
      }
      accountId = insertAccount.id;
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

    const { error: credError } = await supabase.from("gmail_credentials").upsert({
      id: accountId,
      refresh_token: refreshToStore,
      access_token,
      expiry,
      provider: "google",
    });
    if (credError) {
      console.error("Upsert credentials error:", credError);
      return new Response("DB error", { status: 500 });
    }

    await supabase.from("profiles").update({ gmail_connected: true }).eq("id", userId);

    return Response.redirect(appRedirect, 302);
  } catch (err) {
    console.error(err);
    return new Response("Internal error", { status: 500 });
  }
});

function parseEmailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const payload = JSON.parse(atob(parts[1]));
  return payload?.email || null;
}
