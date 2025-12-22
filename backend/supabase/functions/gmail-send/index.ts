import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appBase = Deno.env.get("APP_REDIRECT_URL") || "http://localhost:3000";
const functionsBase = `${supabaseUrl}/functions/v1`;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  global: { headers: { "x-client-info": "gmail-send-fn" } },
});

interface SendRequest {
  leadId: string;
  to: string;
  subject: string;
  html: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

interface GmailToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    const body = (await req.json()) as SendRequest;
    if (!body?.leadId || !body?.to || !body?.subject || !body?.html) {
      return new Response("Missing required fields", { status: 400, headers: corsHeaders });
    }

    // Fetch lead + primary gmail account
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, user_id, email, name")
      .eq("id", body.leadId)
      .single();
    if (leadErr || !lead) return respondError("Lead not found", leadErr);

    const { data: account, error: acctErr } = await supabase
      .from("gmail_accounts")
      .select("id, email")
      .eq("user_id", lead.user_id)
      .eq("is_primary", true)
      .maybeSingle();
    if (acctErr || !account) return respondError("Primary Gmail not found", acctErr);

    const { data: creds, error: credErr } = await supabase
      .from("gmail_credentials")
      .select("refresh_token")
      .eq("id", account.id)
      .single();
    if (credErr || !creds?.refresh_token) return respondError("Missing refresh token", credErr);

    const token = await refreshAccessToken(creds.refresh_token);
    if (!token) return respondError("Token refresh failed", null);

    // Tracking pixel
    const pixelUrl = new URL(`${functionsBase}/email-open`);
    const messageIdPlaceholder = crypto.randomUUID(); // temporary until stored
    pixelUrl.searchParams.set("msg", messageIdPlaceholder);
    const htmlWithPixel = `${body.html}<img src="${pixelUrl.toString()}" alt="" width="1" height="1" style="display:none" />`;

    const raw = buildMime({
      to: body.to,
      from: account.email,
      subject: body.subject,
      html: htmlWithPixel,
      inReplyTo: body.inReplyTo,
      references: body.references,
    });

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw, threadId: body.threadId }),
    });
    if (!sendRes.ok) {
      const errText = await sendRes.text();
      return respondError("Gmail send failed", errText);
    }
    const sendJson = await sendRes.json();
    console.log("gmail-send response", { status: sendRes.status, sendJson });
    const threadId: string | null = sendJson?.threadId ?? null;
    const gmailMessageId: string | null = sendJson?.id ?? null;
    const resolvedThreadId = threadId || body.threadId || null;

    // Ensure thread row
    let threadDbId: string | null = null;
    if (resolvedThreadId) {
      const { data: existingThread } = await supabase
        .from("email_threads")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("thread_id", resolvedThreadId)
        .maybeSingle();
      if (existingThread?.id) {
        threadDbId = existingThread.id;
        await supabase
          .from("email_threads")
          .update({ last_message_at: new Date().toISOString(), status: "sent" })
          .eq("id", threadDbId);
      } else {
        const { data: insertThread, error: insThreadErr } = await supabase
          .from("email_threads")
          .insert({
            lead_id: lead.id,
            gmail_account_id: account.id,
            thread_id: resolvedThreadId,
            subject: body.subject,
            status: "sent",
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insThreadErr) return respondError("Insert thread error", insThreadErr);
        threadDbId = insertThread.id;
      }
    }

    // Insert message row
    const sentAt = new Date().toISOString();
    const { data: messageRow, error: msgErr } = await supabase
      .from("email_messages")
      .insert({
        thread_id: threadDbId,
        gmail_message_id: gmailMessageId,
        gmail_thread_id: resolvedThreadId,
        direction: "sent",
        subject: body.subject,
        snippet: body.html.slice(0, 180),
        body_html: htmlWithPixel,
        sent_at: sentAt,
      })
      .select("id")
      .single();
    if (msgErr) return respondError("Insert message error", msgErr);

    // Update tracking pixel with real message id (best effort)
    const finalPixelUrl = new URL(`${functionsBase}/email-open`);
    finalPixelUrl.searchParams.set("msg", messageRow.id);
    const finalRaw = buildMime({
      to: body.to,
      from: account.email,
      subject: body.subject,
      html: `${body.html}<img src="${finalPixelUrl.toString()}" alt="" width="1" height="1" style="display:none" />`,
      inReplyTo: body.inReplyTo,
      references: body.references || body.inReplyTo,
    });
    // Optionally skip resend; leave as-is for now.

    // Update lead status
    await supabase
      .from("leads")
      .update({ status: "sent", sent_at: sentAt, email: body.to })
      .eq("id", lead.id);

    return new Response(JSON.stringify({
      ok: true,
      threadId,
      messageId: gmailMessageId,
      dbThreadId: threadDbId,
      dbMessageId: messageRow.id,
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    console.error(err);
    return respondError("Internal error", err);
  }
});

function buildMime(opts: { to: string; from: string; subject: string; html: string; inReplyTo?: string; references?: string }) {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
  ];
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);
  const msg = `${headers.join("\r\n")}\r\n\r\n${opts.html}`;
  return utf8Base64(msg).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function refreshAccessToken(refreshToken: string): Promise<GmailToken | null> {
  const params = new URLSearchParams({
    client_id: Deno.env.get("GMAIL_OAUTH_CLIENT_ID") || "",
    client_secret: Deno.env.get("GMAIL_OAUTH_CLIENT_SECRET") || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    console.error("Refresh token failed", await res.text());
    return null;
  }
  return (await res.json()) as GmailToken;
}

function respondError(message: string, err: any) {
  console.error(message, err);
  const details = typeof err === "string" ? err : err?.message || err?.details || err;
  return new Response(JSON.stringify({ error: message, details }), {
    status: 500,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function utf8Base64(str: string) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
