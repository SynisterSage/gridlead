import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "600",
};

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  global: { headers: { "x-client-info": "gmail-poll-fn" } },
});

interface PollRequest {
  userId?: string;
}

const manualCooldownMs = 60_000; // 1 minute per user for manual trigger
const manualMap = new Map<string, number>();

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    const isManual = req.method === "POST";
    const body: PollRequest = isManual ? await req.json().catch(() => ({})) : {};
    const userId = body.userId || null;

    if (isManual && userId) {
      const last = manualMap.get(userId) || 0;
      if (Date.now() - last < manualCooldownMs) {
        return new Response("Too many requests", { status: 429, headers: corsHeaders });
      }
      manualMap.set(userId, Date.now());
    }

    // Fetch primary gmail accounts
    const { data: accounts, error: acctErr } = await supabase
      .from("gmail_accounts")
      .select("id, user_id, email, is_primary")
      .eq("is_primary", true);
    if (acctErr) return respondError("Account fetch error", acctErr);

    const results: Array<{ accountId: string; newMessages: number }> = [];

    for (const acct of accounts || []) {
      const token = await getAccessToken(acct.id);
      if (!token) continue;

      // threads for this account
      const { data: threads } = await supabase
        .from("email_threads")
        .select("id, thread_id, lead_id")
        .eq("gmail_account_id", acct.id);
      if (!threads?.length) continue;

      let newMsgs = 0;
      for (const th of threads) {
        if (!th.thread_id) continue;
        const threadRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${th.thread_id}?format=metadata`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!threadRes.ok) continue;
        const threadJson = await threadRes.json();
        const messages = threadJson?.messages || [];
        for (const m of messages) {
          const gmId = m.id as string;
          // skip if exists
          const { data: exists } = await supabase
            .from("email_messages")
            .select("id")
            .eq("thread_id", th.id)
            .eq("gmail_message_id", gmId)
            .maybeSingle();
          if (exists) continue;

          const headers = m?.payload?.headers || [];
          const subject = headerVal(headers, "Subject") || "";
          const from = headerVal(headers, "From") || "";
          const dateHeader = headerVal(headers, "Date") || "";
          const messageIdHeader = headerVal(headers, "Message-ID");
          const sentAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
          const snippet = m.snippet || "";
          // Determine direction by extracting addresses from the From header and
          // comparing canonicalized addresses to the account's email. This avoids
          // false positives when the From header contains display names or extra text.
          const senderEmails = extractEmails(from);
          const acctEmail = (acct.email || "").toLowerCase();
          const direction = senderEmails.some(e => e === acctEmail) ? "sent" : "inbound";

          await supabase.from("email_messages").insert({
            thread_id: th.id,
            gmail_message_id: gmId,
            gmail_thread_id: m.threadId || th.thread_id,
            message_id_header: messageIdHeader,
            direction,
            subject,
            snippet,
            body_html: null,
            sent_at: sentAt,
          });
          newMsgs++;

          await supabase
            .from("email_threads")
            .update({ last_message_at: sentAt, status: direction === "inbound" ? "responded" : "sent" })
            .eq("id", th.id);

          if (direction === "inbound") {
            await supabase.from("leads").update({ status: "responded" }).eq("id", th.lead_id);

            // Create an in-app notification for inbound replies so the frontend
            // (Notification Center / realtime feed) can show it immediately.
            // Guard: only create one recent notification per lead to avoid spam
            // (5 minute window).
            try {
              const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
              const { data: existing, error: existErr } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', acct.user_id)
                .eq('type', 'reply')
                .filter('meta->>leadId', 'eq', String(th.lead_id))
                .gte('created_at', fiveMinAgo)
                .limit(1)
                .maybeSingle();
              if (!existErr && !existing) {
                const title = subject ? `Reply: ${subject}` : `Reply from thread`;
                const bodyText = snippet || subject || 'You have a new reply.';
                // Insert and capture created row so we can include its id in the
                // push payload (serverNotificationId) to help clients de-dup.
                const { data: created, error: createErr } = await supabase.from('notifications').insert({
                  user_id: acct.user_id,
                  type: 'reply',
                  title,
                  body: bodyText,
                  channel: 'in_app',
                  meta: {
                    leadId: th.lead_id,
                    threadId: th.id,
                    gmail_thread_id: m.threadId || th.thread_id,
                  },
                }).select().maybeSingle();

                const serverNotificationId = created?.id || null;

                // If we have service role key and supabase URL, try to send a push
                // to any saved web push subscriptions for this user so the client
                // receives the notification immediately (hot update).
                try {
                  const { data: subs } = await supabase
                    .from('web_push_subscriptions')
                    .select('*')
                    .eq('user_id', acct.user_id);
                  if (subs && subs.length) {
                    for (const s of subs) {
                      try {
                        // Call the send-push function endpoint with service role key
                        // so it can deliver the push.
                        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
                            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''}`,
                          },
                          body: JSON.stringify({
                            subscription: s.subscription,
                            payload: {
                              type: 'reply',
                              title,
                              body: bodyText,
                              meta: {
                                leadId: th.lead_id,
                                threadId: th.id,
                                gmail_thread_id: m.threadId || th.thread_id,
                                serverNotificationId,
                              },
                            },
                          }),
                        });
                      } catch (pushErr) {
                        console.warn('Failed to send push for reply', pushErr);
                      }
                    }
                  }
                } catch (pushQueryErr) {
                  console.warn('Failed to load web_push_subscriptions', pushQueryErr);
                }
              }
            } catch (notifErr) {
              console.warn('Failed to create reply notification', notifErr);
            }
          }
        }
      }
      results.push({ accountId: acct.id, newMessages: newMsgs });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error(err);
    return respondError("Internal error", err);
  }
});

function headerVal(headers: any[], name: string): string | null {
  const h = headers.find((x) => (x.name || "").toLowerCase() === name.toLowerCase());
  return h?.value || null;
}

function extractEmails(text: string | null): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const re = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function decodeHtmlEntities(str: string) {
  return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function cleanSnippetForNotification(raw: string) {
  if (!raw) return '';
  let s = decodeHtmlEntities(raw);
  // Split into lines and remove quoted sections and common reply headers
  const lines = s.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const filtered = lines.filter(l => !/^(on\s.+wrote:)|(^>+)|(^--+Original)|(^from:)|(^to:)|(^sent:)/i.test(l));
  if (filtered.length === 0) return lines[0] || s;
  // Prefer the first short meaningful line
  for (const line of filtered) {
    if (line.length > 20) return line;
  }
  return filtered[0] || lines[0] || s;
}

async function getAccessToken(accountId: string): Promise<string | null> {
  const { data: cred, error } = await supabase
    .from("gmail_credentials")
    .select("refresh_token")
    .eq("id", accountId)
    .single();
  if (error || !cred?.refresh_token) return null;
  const params = new URLSearchParams({
    client_id: Deno.env.get("GMAIL_OAUTH_CLIENT_ID") || "",
    client_secret: Deno.env.get("GMAIL_OAUTH_CLIENT_SECRET") || "",
    refresh_token: cred.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    console.error("poll refresh failed", await res.text());
    return null;
  }
  const json = await res.json();
  return json?.access_token || null;
}

function respondError(message: string, err: any) {
  console.error(message, err);
  const details = typeof err === "string" ? err : err?.message || err?.details || err;
  return new Response(JSON.stringify({ error: message, details }), {
    status: 500,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}