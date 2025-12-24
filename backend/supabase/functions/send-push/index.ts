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

    // Implement a minimal Deno-native Web Push sender using VAPID (no payload encryption)
    // This sends a push with an empty body (service worker will still show a default notification).
    // Helpers
    const b64UrlToUint8 = (str: string) => {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      const pad = (4 - (str.length % 4)) % 4;
      str = str + '='.repeat(pad);
      const bin = atob(str);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    };
    const uint8ToB64Url = (arr: Uint8Array) => {
      let s = '';
      for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
      let b64 = btoa(s);
      b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return b64;
    };

    // Convert VAPID private key (base64url) to JWK and import for ECDSA signing
    async function importVapidPrivateKey(d_b64url: string) {
      // We need the public coordinates x and y in the JWK for EC private key import.
      // Use VAPID_PUBLIC_KEY env (expected to be base64url of uncompressed public key,
      // possibly starting with 0x04) to extract x and y.
      try {
        let pubBytes = b64UrlToUint8(VAPID_PUBLIC_KEY || '');
        if (!pubBytes || pubBytes.length === 0) throw new Error('VAPID_PUBLIC_KEY missing or invalid');
        // If uncompressed public key has leading 0x04, strip it
        if (pubBytes.length === 65 && pubBytes[0] === 0x04) pubBytes = pubBytes.slice(1);
        if (pubBytes.length !== 64) throw new Error('Unexpected public key length: ' + pubBytes.length);
        const xBytes = pubBytes.slice(0, 32);
        const yBytes = pubBytes.slice(32, 64);
        const x = uint8ToB64Url(xBytes);
        const y = uint8ToB64Url(yBytes);
        const jwk: any = { kty: 'EC', crv: 'P-256', x, y, d: d_b64url, ext: true };
        const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
        return key;
      } catch (e) {
        console.error('Failed to import VAPID private key as JWK', e?.message || e);
        throw e;
      }
    }

    // Create VAPID JWT (ES256) signed with privateKey
    async function createVapidJwt(privateKey: CryptoKey, aud: string, subject: string) {
      const header = { alg: 'ES256', typ: 'JWT' };
      const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours
      const payload = { aud, exp, sub: subject };
      const enc = new TextEncoder();
      const toSign = `${uint8ToB64Url(new Uint8Array(enc.encode(JSON.stringify(header))))}.${uint8ToB64Url(new Uint8Array(enc.encode(JSON.stringify(payload))))}`;
      // subtle.sign with ECDSA returns DER signature; need to convert to r||s raw
      const sigBuf = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(toSign)));
      // parse DER to r and s (or handle raw r||s if returned directly)
      function derToRaw(sig: Uint8Array) {
        // Robust DER parser for ECDSA signature (handles long-form lengths)
        let idx = 0;
        if (sig[idx++] !== 0x30) throw new Error('Invalid DER signature');

        // read sequence length (support short and long form)
        let seqLen = sig[idx++];
        if (seqLen & 0x80) {
          const n = seqLen & 0x7f;
          seqLen = 0;
          for (let i = 0; i < n; i++) {
            seqLen = (seqLen << 8) + sig[idx++];
          }
        }

        if (sig[idx++] !== 0x02) throw new Error('Invalid DER signature (no integer for r)');

        let rLen = sig[idx++];
        if (rLen & 0x80) {
          const n = rLen & 0x7f;
          rLen = 0;
          for (let i = 0; i < n; i++) {
            rLen = (rLen << 8) + sig[idx++];
          }
        }
        let r = sig.slice(idx, idx + rLen); idx += rLen;

        if (sig[idx++] !== 0x02) throw new Error('Invalid DER signature (no integer for s)');

        let sLen = sig[idx++];
        if (sLen & 0x80) {
          const n = sLen & 0x7f;
          sLen = 0;
          for (let i = 0; i < n; i++) {
            sLen = (sLen << 8) + sig[idx++];
          }
        }
        let s = sig.slice(idx, idx + sLen);

        // remove leading zeros if present
        if (r.length > 32) {
          // strip possible leading 0x00
          while (r.length > 0 && r[0] === 0x00) r = r.slice(1);
        }
        if (s.length > 32) {
          while (s.length > 0 && s[0] === 0x00) s = s.slice(1);
        }

        // pad to 32 bytes
        if (r.length < 32) { const tmp = new Uint8Array(32); tmp.set(r, 32 - r.length); r = tmp; }
        if (s.length < 32) { const tmp = new Uint8Array(32); tmp.set(s, 32 - s.length); s = tmp; }
        const raw = new Uint8Array(64);
        raw.set(r, 0); raw.set(s, 32);
        return raw;
      }
      let rawSig: Uint8Array;
      // If signature already looks like raw r||s (64 bytes), use directly
      if (sigBuf.length === 64 && sigBuf[0] !== 0x30) {
        rawSig = sigBuf;
      } else if (sigBuf[0] === 0x30) {
        rawSig = derToRaw(sigBuf);
      } else {
        // Unexpected format — try parsing as DER anyway
        rawSig = derToRaw(sigBuf);
      }
      const jwt = `${toSign}.${uint8ToB64Url(rawSig)}`;
      return jwt;
    }

    // Build public key raw from exported jwk (x,y)
    async function publicKeyFromPrivateKey(privateKey: CryptoKey) {
      const jwk = await crypto.subtle.exportKey('jwk', privateKey) as any;
      if (!jwk.x || !jwk.y) throw new Error('Failed to export public coordinates');
      const x = b64UrlToUint8(jwk.x);
      const y = b64UrlToUint8(jwk.y);
      const pub = new Uint8Array(1 + x.length + y.length);
      pub[0] = 0x04;
      pub.set(x, 1);
      pub.set(y, 1 + x.length);
      return pub;
    }

    try {
      // Import VAPID private key
      const d_b64url = VAPID_PRIVATE_KEY;
      const privateKey = await importVapidPrivateKey(d_b64url);
      // derive public key bytes
      const pubRaw = await publicKeyFromPrivateKey(privateKey);
      const pubB64Url = uint8ToB64Url(pubRaw);
      // audience is origin of endpoint
      const epUrl = new URL(endpoint);
      const aud = `${epUrl.protocol}//${epUrl.host}`;
      const jwt = await createVapidJwt(privateKey, aud, VAPID_SUBJECT);

      // send empty body push with VAPID headers
      const headers = new Headers();
      headers.set('TTL', '60');
      headers.set('Authorization', `WebPush ${jwt}`);
      headers.set('Crypto-Key', `p256ecdsa=${pubB64Url}`);

      const resp = await fetch(endpoint, { method: 'POST', headers, body: '' });
      if (resp.status === 410 || resp.status === 404) {
        await tryDeleteSubscription(endpoint);
      }
      if (resp.ok) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      const text = await resp.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'push_failed', status: resp.status, body: text }), { status: resp.status || 500, headers: corsHeaders });
    } catch (e: any) {
      console.error('Deno-native push error', e?.message || e);
      return new Response(JSON.stringify({ error: 'native_push_failed', detail: e?.message || String(e) }), { status: 500, headers: corsHeaders });
    }
  } catch (err: any) {
    console.error('send-push error', err);
    return new Response(JSON.stringify({ error: err?.message || 'unexpected_error' }), { status: 500, headers: corsHeaders });
  }
});
