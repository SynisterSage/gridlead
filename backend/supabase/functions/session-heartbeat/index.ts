import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  global: { headers: { "x-client-info": "session-heartbeat-fn" } },
});

type Payload = {
  fingerprint?: string;
  userAgent?: string | null;
  expiresAt?: string | null;
};

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

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return respondError("Missing Authorization token", 401);

  const { data: userResp } = await supabase.auth.getUser(token);
  const user = userResp?.user;
  if (!user) return respondError("Unauthorized", 401);

  const body = (await req.json().catch(() => ({}))) as Payload;
  const fingerprint = body.fingerprint || null;
  if (!fingerprint) return respondError("Missing fingerprint", 400);

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = body.expiresAt || null;
  const userAgent = body.userAgent || req.headers.get("User-Agent") || null;

  // Check existing session
  const { data: existing, error: selErr } = await supabase
    .from("user_sessions")
    .select("id, revoked_at, expires_at, user_id")
    .eq("user_id", user.id)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (selErr) {
    console.error("session-heartbeat select error", selErr);
  }

  const isExpired = (existing?.expires_at && new Date(existing.expires_at).getTime() < now.getTime());
  const isRevoked = !!existing?.revoked_at;

  if (isExpired || isRevoked) {
    return json({ revoked: true });
  }

  const { data, error } = await supabase
    .from("user_sessions")
    .upsert({
      user_id: user.id,
      fingerprint,
      user_agent: userAgent,
      last_seen: nowIso,
      expires_at: expiresAt,
      revoked_at: null,
    }, { onConflict: "user_id,fingerprint" })
    .select()
    .maybeSingle();

  if (error) {
    console.error("session-heartbeat upsert error", error);
    return respondError("Failed to update session", 500);
  }

  return json({ ok: true, session: data, revoked: false });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function respondError(message: string, status = 400) {
  return json({ error: message }, status);
}
