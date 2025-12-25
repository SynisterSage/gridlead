// Supabase Edge Function: weekly-summary
// Sends weekly performance emails via Resend and inserts an in-app notification.
// Env vars required:
// RESEND_API_KEY, RESEND_FROM_EMAIL, APP_BASE_URL (for CTA)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

type LeadRow = {
  id: string;
  name: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type UserNotifRow = {
  user_id: string;
  weekly: boolean | null;
};

type ProfileRow = {
  id: string;
  monthly_goal: number | null;
  display_name?: string | null;
};

const AVG_DEAL_SIZE = 2500;
const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'http://gridlead.space';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const renderEmail = (data: {
  name: string;
  stats: {
    volume: number;
    replies: number;
    wins: number;
    pipeline: number;
    goal: number;
    progressPct: number;
  };
  trend: {
    volumePrev: number;
    repliesPrev: number;
    winsPrev: number;
    pipelinePrev: number;
  };
  topLeads: { name: string; status: string }[];
}) => {
  const diffPct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '+100%' : '0%';
    return `${curr >= prev ? '+' : ''}${(((curr - prev) / prev) * 100).toFixed(0)}%`;
  };

  const section = (label: string, value: string, change: string) => `
    <div style="padding:12px 14px;border-radius:14px;background:rgba(255,255,255,0.03);">
      <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#94a3b8;font-weight:700;">${label}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
        <div style="font-size:22px;font-weight:800;color:#e2e8f0;">
          <span style="vertical-align:baseline;">${value}</span><sup style="font-size:11px;color:#22c55e;font-weight:800;margin-left:6px;vertical-align:super;">${change}</sup>
        </div>
      </div>
    </div>
  `;

  const leadItems = data.topLeads.length
    ? data.topLeads
        .map(
          (l) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);color:#e2e8f0;font-weight:700;">${l.name}</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);color:#94a3b8;font-weight:700;text-align:right;text-transform:uppercase;font-size:11px;">${l.status}</td>
        </tr>`
        )
        .join('')
    : `<tr><td style="padding:10px 0;color:#94a3b8;">No recent leads.</td></tr>`;

  // Build a clean, consistent card layout with small responsive tweaks
  return `
  <div style="background:#0b1220;color:#e2e8f0;font-family:Inter,Arial,sans-serif;padding:22px;border-radius:16px;max-width:680px;margin:0 auto;border:0;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#9aa8bd;font-weight:800;margin-bottom:6px;">Weekly Summary</div>
          <div style="font-size:20px;font-weight:900;color:#e6eef6;line-height:1.1;">Hi ${data.name || 'there'}, here’s your performance snapshot.</div>
        </div>
        <div style="text-align:right;font-size:12px;color:#94a3b8">${new Date().toLocaleDateString()}</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;">
        ${section('Outreach Volume', `<span style=\"font-size:20px;\">${data.stats.volume}</span>`, diffPct(data.stats.volume, data.trend.volumePrev))}
        ${section('Replies', `<span style=\"font-size:20px;\">${data.stats.replies}</span>`, diffPct(data.stats.replies, data.trend.repliesPrev))}
        ${section('Wins', `<span style=\"font-size:20px;\">${data.stats.wins}</span>`, diffPct(data.stats.wins, data.trend.winsPrev))}
        ${section('Pipeline Value', `<span style=\"font-size:18px;\">$${data.stats.pipeline.toLocaleString()}</span>`, diffPct(data.stats.pipeline, data.trend.pipelinePrev))}
      </div>

      <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.02);margin-bottom:16px;">
        <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#9aa8bd;font-weight:700;margin-bottom:8px;">Goal Progress</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="font-size:14px;font-weight:800;color:#e6eef6;">$${(data.stats.pipeline).toLocaleString()} pipeline</div>
          <div style="font-size:12px;font-weight:800;color:#22c55e;">${data.stats.progressPct.toFixed(0)}% of $${(data.stats.goal || 0).toLocaleString()}</div>
        </div>
        <div style="width:100%;height:12px;border-radius:999px;background:#0f172a;overflow:hidden;margin-top:10px;">
          <div style="height:100%;width:${Math.min(100, data.stats.progressPct)}%;background:linear-gradient(90deg,#16a34a,#06b6d4);"></div>
        </div>
      </div>

      <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.01);margin-bottom:16px;">
        <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#9aa8bd;font-weight:700;margin-bottom:8px;">Top Leads</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e6eef6;">
          ${leadItems}
        </table>
      </div>

      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:6px;">
        <a href="${appBaseUrl}" style="display:block;width:100%;padding:12px 18px;border-radius:999px;background:#10b981;color:#04242b;font-weight:900;text-decoration:none;letter-spacing:0.4px;text-align:center;">Open Dashboard</a>
        <div style="width:100%;max-width:560px;margin-top:12px;font-size:12px;color:#8fa0b4;text-align:center;display:block;padding:0 6px;">
          Manage your notification preferences in <span style="color:#a8e6cf;font-weight:700;">Settings</span>.
        </div>
      </div>
    </div>
  </div>
  `;
};

const sendEmail = async (to: string, subject: string, html: string) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error('Resend error', res.status, txt);
    throw new Error(`Resend error ${res.status}`);
  }
};

const summarize = (leads: LeadRow[]) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  const prevStart = new Date();
  prevStart.setDate(start.getDate() - 7);
  const prevEnd = new Date();
  prevEnd.setDate(start.getDate() - 1);

  const inRange = (d: Date, a: Date, b: Date) => d >= a && d <= b;

  const current = { volume: 0, replies: 0, wins: 0, pipeline: 0 };
  const previous = { volume: 0, replies: 0, wins: 0, pipeline: 0 };

  const top: { name: string; status: string; updated_at: string }[] = [];

  leads.forEach((l) => {
    const ts = l.updated_at ? new Date(l.updated_at) : new Date();
    const add = (bucket: typeof current) => {
      if (['sent', 'responded', 'won'].includes(l.status)) {
        bucket.volume += 1;
        bucket.pipeline += AVG_DEAL_SIZE;
      }
      if (['responded'].includes(l.status)) bucket.replies += 1;
      if (l.status === 'won') bucket.wins += 1;
    };
    if (inRange(ts, start, end)) add(current);
    if (inRange(ts, prevStart, prevEnd)) add(previous);
    if (inRange(ts, start, end)) {
      top.push({ name: l.name, status: l.status, updated_at: l.updated_at });
    }
  });

  top.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return { current, previous, top: top.slice(0, 5) };
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
    }

    const url = new URL(req.url);
    const forceSend = url.searchParams.get('force') === '1';
    const onlyUser = url.searchParams.get('user_id') || null;

    console.log('weekly-summary debug', { forceSend, onlyUser });

    const results: Array<Record<string, unknown>> = [];

    // Fetch users with weekly enabled
    const { data: users, error: usersError } = await supabase
      .from('user_notifications')
      .select('user_id, weekly');

    if (usersError) {
      console.error('failed to fetch user_notifications', usersError);
      throw usersError;
    }

    let targets = (users || []).filter((u: UserNotifRow) => !!u.weekly);
    console.log('found user_notifications count', (users || []).length, 'weekly-enabled', targets.length);
    if (onlyUser) targets = targets.filter(t => t.user_id === onlyUser);
    console.log('targets after filtering by onlyUser', targets.map(t => t.user_id));

    // Helper: send with retries
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const sendWithRetry = async (to: string, subject: string, html: string) => {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await sendEmail(to, subject, html);
          return { ok: true };
        } catch (err: any) {
          console.warn(`send attempt ${attempt} failed for ${to}`, err?.message || err);
          if (attempt < maxAttempts) {
            await sleep(500 * Math.pow(2, attempt - 1));
            continue;
          }
          return { ok: false, error: err?.message || String(err) };
        }
      }
      return { ok: false, error: 'unknown' };
    };

    const processTarget = async (target: UserNotifRow) => {
      try {
        // Fetch profile
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('id, monthly_goal, display_name')
          .eq('id', target.user_id)
          .maybeSingle();
        if (profErr || !profile) {
          console.warn('profile missing or error for user', target.user_id, profErr);
          return { user_id: target.user_id, status: 'skip', reason: 'no_profile_or_error', error: profErr?.message };
        }

        // Fetch user auth email
        const { data: auth } = await supabase.auth.admin.getUserById(target.user_id);
        let toEmail = auth.user?.email || '';

        // Prefer primary Gmail if available
        const { data: gmail } = await supabase
          .from('gmail_accounts')
          .select('email, is_primary, status')
          .eq('user_id', target.user_id)
          .eq('status', 'connected')
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (gmail?.email) toEmail = gmail.email;

        if (!toEmail) return { user_id: target.user_id, status: 'skip', reason: 'no_target_email' };

        // Fetch leads
        const { data: leads } = await supabase
          .from('leads')
          .select('id,name,status,updated_at,created_at,sent_at')
          .eq('user_id', target.user_id);

        const summary = summarize((leads || []) as any as LeadRow[]);

        // Skip if no activity
        if (
          summary.current.volume === 0 &&
          summary.current.replies === 0 &&
          summary.current.wins === 0
        ) {
          if (!forceSend) return { user_id: target.user_id, status: 'skip', reason: 'no_activity_last_7d' };
        }

        const goal = profile.monthly_goal || 0;
        const currentRevenue = summary.current.wins * AVG_DEAL_SIZE;
        const progressPct = goal > 0 ? (currentRevenue / goal) * 100 : 0;

        const html = renderEmail({
          name: profile.display_name || auth.user?.email?.split('@')[0] || 'there',
          stats: {
            volume: summary.current.volume,
            replies: summary.current.replies,
            wins: summary.current.wins,
            pipeline: summary.current.pipeline,
            goal,
            progressPct,
          },
          trend: {
            volumePrev: summary.previous.volume,
            repliesPrev: summary.previous.replies,
            winsPrev: summary.previous.wins,
            pipelinePrev: summary.previous.pipeline,
          },
          topLeads: summary.top.map((l) => ({ name: l.name, status: l.status })),
        });

        const sendRes = await sendWithRetry(toEmail, 'Your Weekly GridLead Summary', html);
        if (!sendRes.ok) {
          return { user_id: target.user_id, status: 'error', email: toEmail, error: sendRes.error };
        }

        // Insert in-app notification
        await supabase.from('notifications').insert({
          user_id: target.user_id,
          type: 'weekly',
          title: 'Weekly summary sent',
          body: 'Check your inbox for the latest performance recap.',
          channel: 'in_app',
        });

        return { user_id: target.user_id, status: 'sent', email: toEmail, stats: summary.current };
      } catch (err: any) {
        console.error('processTarget error', target.user_id, err);
        return { user_id: target.user_id, status: 'error', error: err?.message || String(err) };
      }
    };

    // Process in batches to limit concurrency and protect rate limits
    const concurrency = 5;
    for (let i = 0; i < targets.length; i += concurrency) {
      const batch = targets.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((t) => processTarget(t as UserNotifRow)));
      results.push(...batchResults);
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
});