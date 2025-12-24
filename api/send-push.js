const webpush = require('web-push');

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@gridlead.space';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    console.warn('web-push setVapidDetails failed:', e && e.message ? e.message : e);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: 'VAPID keys not configured on server.' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body);
      const subscription = parsed.subscription;
      const payload = parsed.payload ?? { title: 'GridLead test', body: 'This is a test push from GridLead.' };

      if (!subscription) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'Missing subscription' }));
        return;
      }

      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        const status = err && err.statusCode ? err.statusCode : 500;
        console.error('web-push send error', status, err && err.message ? err.message : err);
        res.writeHead(status, corsHeaders);
        res.end(JSON.stringify({ error: err && err.message ? err.message : 'send_failed' }));
      }
    } catch (e) {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify({ error: 'invalid_json', detail: e && e.message ? e.message : String(e) }));
    }
  });
};
