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
  global: { headers: { "x-server-function": "outreach-messages" } },
});

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const leadId = body?.leadId;
    const includeArchived = !!body?.includeArchived;
    if (!leadId) return new Response(JSON.stringify({ error: 'missing leadId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) return new Response(JSON.stringify({ error: 'missing auth token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token as string);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: 'invalid auth token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const uid = userData.user.id;

    const { data: leadRow, error: leadErr } = await supabase.from('leads').select('id,user_id,archived_at').eq('id', leadId).maybeSingle();
    if (leadErr || !leadRow) return new Response(JSON.stringify({ error: 'lead not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (leadRow.user_id !== uid) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (leadRow.archived_at && !includeArchived) {
      return new Response(JSON.stringify({ error: 'lead archived' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    let threadsQuery = supabase.from('email_threads').select('id,thread_id,archived_at').eq('lead_id', leadId);
    if (!includeArchived) threadsQuery = threadsQuery.is('archived_at', null);
    const { data: threads, error: threadErr } = await threadsQuery;
    if (threadErr) return new Response(JSON.stringify({ error: 'failed to load threads', details: threadErr }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const threadIds = (threads || []).map((t: any) => t.id).filter(Boolean);
    const gmailThreadIds = (threads || []).map((t: any) => t.thread_id).filter(Boolean);

    let messagesQuery = supabase.from('email_messages').select('id,direction,snippet,subject,sent_at,body_html,gmail_message_id,gmail_thread_id,message_id_header,thread_id,email_threads(id,lead_id,thread_id)').order('sent_at', { ascending: false }).limit(200);
    const orParts: string[] = [];
    if (threadIds.length > 0) {
      const csv = threadIds.map((s: string) => `"${s}"`).join(',');
      orParts.push(`thread_id.in.(${csv})`);
    }
    if (gmailThreadIds.length > 0) {
      const csv = gmailThreadIds.map((s: string) => `"${s}"`).join(',');
      orParts.push(`gmail_thread_id.in.(${csv})`);
    }
    if (orParts.length === 0) orParts.push('thread_id.is.null');
    const { data: messages, error: msgErr } = await messagesQuery.or(orParts.join(','));
    if (msgErr) return new Response(JSON.stringify({ error: 'failed to load messages', details: msgErr }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify({ ok: true, threads, messages }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'internal' , details: String(err)}), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
