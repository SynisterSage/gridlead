import webpush from 'https://esm.sh/web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@gridlead.space';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

let supabase: any = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { 'x-client-info': 'send-push-fn' } },
  });
}

interface SendRequest {
  subscription: any;
  payload?: any;
}

async function tryDeleteSubscription(endpoint: string) {
  if (!supabase) return;
  try {
    await supabase.from('web_push_subscriptions').delete().eq('endpoint', endpoint);
    console.log('Deleted expired subscription:', endpoint);
  } catch (e) {
    console.error('Failed to delete expired subscription:', e);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured on server.' }), { status: 500, headers: corsHeaders });
    }

    const body = await req.json().catch(() => null) as SendRequest | null;
    if (!body || !body.subscription) return new Response(JSON.stringify({ error: 'Missing subscription' }), { status: 400, headers: corsHeaders });

    const subscription = body.subscription;
    const endpoint = (subscription && subscription.endpoint) || '';
    if (!endpoint || typeof endpoint !== 'string') return new Response(JSON.stringify({ error: 'Invalid subscription endpoint' }), { status: 400, headers: corsHeaders });

    const data = body.payload ?? { title: 'GridLead test', body: 'This is a test push from GridLead.' };

    try {
      await webpush.sendNotification(subscription, JSON.stringify(data));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    } catch (err: any) {
      const status = err?.statusCode || err?.status || 500;
      console.error('webpush error', status, err?.message || err);
      // If subscription is gone/expired, remove it from DB (410 Gone / 404 Not Found)
      if (status === 410 || status === 404) {
        await tryDeleteSubscription(endpoint);
      }
      return new Response(JSON.stringify({ error: err?.message || 'send_failed' }), { status, headers: corsHeaders });
    }
  } catch (err: any) {
    console.error('send-push error', err);
    return new Response(JSON.stringify({ error: err?.message || 'unexpected_error' }), { status: 500, headers: corsHeaders });
  }
});
