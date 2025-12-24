import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
          if (direction === "inbound") {
            await supabase.from("leads").update({ status: "responded" }).eq("id", th.lead_id);

            // Determine the owner user_id for this lead; prefer the lead owner
            // so the notification is visible to the correct user in the UI.
            let notifyUserId = acct.user_id;
            try {
              const { data: leadRow } = await supabase.from('leads').select('user_id').eq('id', th.lead_id).maybeSingle();
              if (leadRow?.user_id) notifyUserId = leadRow.user_id;
            } catch (e) {
              console.warn('Failed to resolve lead owner, falling back to account user', e);
            }

            // Create an in-app notification for inbound replies so the frontend
            // (Notification Center / realtime feed) can show it immediately.
            // Guard: only create one recent notification per lead to avoid spam
            // (5 minute window). Use the resolved notifyUserId for checks and inserts.
            try {
              const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
              const { data: existing, error: existErr } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', notifyUserId)
                .eq('type', 'reply')
                .filter('meta->>leadId', 'eq', String(th.lead_id))
                .gte('created_at', fiveMinAgo)
                .limit(1)
                .maybeSingle();
              if (!existErr && !existing) {
                const title = subject ? `Reply: ${subject}` : `Reply from thread`;
                const bodyText = cleanSnippetForNotification(snippet) || subject || 'You have a new reply.';
                // Insert and capture created row so we can include its id in the
                // push payload (serverNotificationId) to help clients de-dup.
                const { data: created, error: createErr } = await supabase.from('notifications').insert({
                  user_id: notifyUserId,
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
                    .eq('user_id', notifyUserId);
                  if (subs && subs.length) {
                    for (const s of subs) {
                      try {
                        // Prefer calling app-hosted Node fallback which supports
                        // encrypted payloads so the service worker receives the
                        // payload and app can hot-insert the notification.
                        const appBase = Deno.env.get('APP_BASE_URL') || Deno.env.get('VITE_SITE_URL') || '';
                        const sendPushUrl = appBase ? `${appBase.replace(/\/$/, '')}/api/send-push` : `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`;
                        await fetch(sendPushUrl, {
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
                const bodyText = cleanSnippetForNotification(snippet) || subject || 'You have a new reply.';
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
                        // Prefer calling app-hosted Node fallback which supports
                        // encrypted payloads so the service worker receives the
                        // payload and app can hot-insert the notification.
                        const appBase = Deno.env.get('APP_BASE_URL') || Deno.env.get('VITE_SITE_URL') || '';
                        const sendPushUrl = appBase ? `${appBase.replace(/\/$/, '')}/api/send-push` : `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`;
                        await fetch(sendPushUrl, {
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