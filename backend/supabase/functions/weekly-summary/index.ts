// Supabase Edge Function: weekly-summary
// Sends weekly performance emails via SendGrid and inserts an in-app notification.
// Env vars required:
// SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME, APP_BASE_URL (for CTA)

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
const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY') || '';
const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL') || '';
const fromName = Deno.env.get('SENDGRID_FROM_NAME') || 'GridLead';
const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'gridlead.space';

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
    <div style="padding:12px 14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);">
      <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#94a3b8;font-weight:700;">${label}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
        <div style="font-size:22px;font-weight:800;color:#e2e8f0;">${value}</div>
        <div style="font-size:11px;font-weight:800;color:#22c55e;">${change}</div>
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

  return `
  <div style="background:#0f172a;color:#e2e8f0;font-family:'Inter',Arial,sans-serif;padding:28px;border-radius:20px;max-width:640px;margin:0 auto;border:1px solid #1e293b;">
    <div style="margin-bottom:18px;">
      <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#94a3b8;font-weight:800;">Weekly Summary</div>
      <div style="font-size:22px;font-weight:900;color:#e2e8f0;">Hi ${data.name || 'there'}, here’s your performance snapshot.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px;">
      ${section('Outreach Volume', data.stats.volume.toString(), diffPct(data.stats.volume, data.trend.volumePrev))}
      ${section('Replies', data.stats.replies.toString(), diffPct(data.stats.replies, data.trend.repliesPrev))}
      ${section('Wins', data.stats.wins.toString(), diffPct(data.stats.wins, data.trend.winsPrev))}
      ${section('Pipeline Value', `$${data.stats.pipeline.toLocaleString()}`, diffPct(data.stats.pipeline, data.trend.pipelinePrev))}
    </div>
    <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);margin-bottom:18px;">
      <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#94a3b8;font-weight:700;">Goal Progress</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
        <div style="font-size:20px;font-weight:800;color:#e2e8f0;">$${(data.stats.pipeline).toLocaleString()} pipeline</div>
        <div style="font-size:11px;font-weight:800;color:#22c55e;">${data.stats.progressPct.toFixed(0)}% of $${(data.stats.goal || 0).toLocaleString()}</div>
      </div>
      <div style="width:100%;height:10px;border-radius:999px;background:#1e293b;overflow:hidden;margin-top:10px;">
        <div style="height:100%;width:${Math.min(100, data.stats.progressPct)}%;background:linear-gradient(90deg,#22c55e,#06b6d4);"></div>
      </div>
    </div>
    <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:18px;">
      <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#94a3b8;font-weight:700;margin-bottom:10px;">Top Leads</div>
      <table style="width:100%;border-collapse:collapse;">${leadItems}</table>
    </div>
    <div style="text-align:center;margin-top:18px;">
      <a href="${appBaseUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#22c55e;color:#0f172a;font-weight:900;text-decoration:none;letter-spacing:0.5px;">Open Dashboard</a>
    </div>
  </div>
  `;
};

const sendEmail = async (to: string, subject: string, html: string) => {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sendgridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error('SendGrid error', res.status, txt);
    throw new Error(`SendGrid error ${res.status}`);
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

    // Fetch users with weekly enabled
    const { data: users, error: usersError } = await supabase
      .from('user_notifications')
      .select('user_id, weekly');

    if (usersError) throw usersError;

    const targets = (users || []).filter((u: UserNotifRow) => !!u.weekly);

    for (const target of targets) {
      // Fetch profile
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('id, monthly_goal, display_name, email')
        .eq('id', target.user_id)
        .maybeSingle();
      if (profErr || !profile) continue;

      // Fetch user auth email
      const { data: auth } = await supabase.auth.admin.getUserById(target.user_id);
      const toEmail = auth.user?.email;
      if (!toEmail) continue;

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
        continue;
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

      await sendEmail(toEmail, 'Your Weekly GridLead Summary', html);

      // Insert in-app notification
      await supabase.from('notifications').insert({
        user_id: target.user_id,
        type: 'weekly',
        title: 'Weekly summary sent',
        body: 'Check your inbox for the latest performance recap.',
        channel: 'in_app',
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
});