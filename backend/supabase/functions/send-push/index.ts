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

// NOTE: do not import `web-push` at module scope in Deno Edge runtime —
// some of its dependencies (jws/util) require Node builtins and can
// throw during module initialization. We'll dynamically import it inside
// the request handler so OPTIONS preflight can be answered without loading
// the module.

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
    // Answer preflight immediately before attempting to load server modules
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

    // Dynamically import web-push to avoid module initialization errors
    try {
      const mod = await import('https://esm.sh/web-push@3.6.7');
      const webpush = (mod && (mod.default || mod)) as any;
      if (!webpush || typeof webpush.sendNotification !== 'function') {
        console.error('web-push import did not provide expected API', Object.keys(mod || {}));
        return new Response(JSON.stringify({ error: 'web-push unavailable in this runtime' }), { status: 500, headers: corsHeaders });
      }
      try {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      } catch (e) {
        console.warn('setVapidDetails failed', e?.message || e);
      }

      try {
        await webpush.sendNotification(subscription, JSON.stringify(data));
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      } catch (err: any) {
        const status = err?.statusCode || err?.status || 500;
        console.error('webpush send error', status, err?.message || err);
        if (status === 410 || status === 404) {
          await tryDeleteSubscription(endpoint);
        }
        return new Response(JSON.stringify({ error: err?.message || 'send_failed' }), { status, headers: corsHeaders });
      }
    } catch (impErr: any) {
      // Log the import error details so we can see if the module fails to initialize
      console.error('Failed to import web-push in Edge runtime', impErr?.message || impErr);
      return new Response(JSON.stringify({ error: 'server_module_load_failed', detail: impErr?.message || String(impErr) }), { status: 500, headers: corsHeaders });
    }
  } catch (err: any) {
    console.error('send-push error', err);
    return new Response(JSON.stringify({ error: err?.message || 'unexpected_error' }), { status: 500, headers: corsHeaders });
  }
});
