
import React, { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import NavigationDock from './components/NavigationDock';
import HeroDiscovery from './components/HeroDiscovery';
import ReviewQueue from './components/ReviewQueue';
import OutreachBuilder from './components/OutreachBuilder';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import LandingPage from './components/LandingPage';
import Onboarding from './components/Onboarding';
import NotificationCenter from './components/NotificationCenter';
import { AppView, Lead, Profile, NotificationItem } from './types';
import { MOCK_LEADS } from './constants';
import { ThemeProvider } from './ThemeContext';
import { supabase } from './lib/supabaseClient';
import { robustLogout, logAuthState } from './lib/auth';
import { getPlanLimits, isOverLeadLimit } from './lib/planLimits';
import { RealtimeChannel } from '@supabase/supabase-js';

const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'sample-1',
    type: 'reply',
    title: 'New reply received',
    body: 'Prospect replied to your outreach. Check your inbox.',
    created_at: new Date().toISOString(),
    unread: true,
  },
  {
    id: 'sample-2',
    type: 'lead',
    title: 'New lead discovered',
    body: 'We found 3 leads above 90% match.',
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    unread: false,
  },
];

const AGENCY_APPROVED_ACK_KEY = 'gl_agency_approved_notif_seen';

const hasSeenAgencyApproved = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AGENCY_APPROVED_ACK_KEY) === '1';
};

const markAgencyApprovedSeen = () => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AGENCY_APPROVED_ACK_KEY, '1');
};

const AppContent: React.FC = () => {
  const avgDealSize = 2500;
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authProcessing, setAuthProcessing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'signup' | 'login'>('signup');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const RETURN_VIEW_KEY = 'gridlead_return_view';
  const initialView = typeof window !== 'undefined'
    ? (() => {
        const raw = localStorage.getItem(RETURN_VIEW_KEY);
        if (!raw) return null;
        const normalized = raw.toLowerCase() as AppView;
        return normalized || null;
      })()
    : null;
  const [activeView, setActiveView] = useState<AppView>(initialView || AppView.DASHBOARD);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [archivedNotifications, setArchivedNotifications] = useState<NotificationItem[]>([]);
  const [notificationTab, setNotificationTab] = useState<'inbox' | 'archive'>('inbox');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const SESSION_FP_KEY = 'gl_session_fp';
  const SESSION_SEEN_KEY = 'gl_seen_session_ids';
  const notifChannelRef = React.useRef<RealtimeChannel | null>(null);
  const notifDefaults = {
    leads: true,
    replies: true,
    weekly: false,
    browser: false,
    send_failed: true,
    gmail_disconnected: true,
    goal_hit: true,
    lead_assigned: true,
    pipeline_threshold: false,
  };
  const [notifPrefs, setNotifPrefs] = useState(notifDefaults);
  const goalNotifiedRef = React.useRef(false);
  const lastAgencyStatusRef = React.useRef<string | null>(null);
  const profileChannelRef = React.useRef<RealtimeChannel | null>(null);
  const agencyNotifSentRef = React.useRef<boolean>(false);
  const sessionSeenRef = React.useRef<Set<string>>(new Set());

  const rememberSessionSeen = useCallback((key: string) => {
    const set = sessionSeenRef.current;
    set.add(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_SEEN_KEY, JSON.stringify(Array.from(set)));
    }
  }, []);

  const shortUserAgent = (ua?: string | null) => {
    if (!ua) return 'New device';
    return ua.length > 64 ? `${ua.slice(0, 64)}…` : ua;
  };

  const addSessionNotification = useCallback(async (fingerprint: string, ua: string | null) => {
    if (!session) return;
    try {
      const insert = await supabase.from('notifications').insert({
        user_id: session.user.id,
        type: 'session',
        title: 'New device signed in',
        body: ua || 'New device detected',
        meta: { fingerprint, user_agent: ua },
        channel: 'in_app',
      }).select().maybeSingle();
      const created = insert?.data as any;
      if (created) {
        setNotifications(prev => {
          if (prev.some(n => n.id === created.id)) return prev;
          const item: NotificationItem = {
            id: created.id,
            type: created.type,
            title: created.title,
            body: created.body,
            created_at: created.created_at,
            unread: !created.read_at,
            archived_at: created.archived_at || null,
            meta: created.meta || {},
          };
          return [item, ...prev].slice(0, 100);
        });
        rememberSessionSeen(fingerprint);
      }
    } catch (e) {
      console.warn('Failed to insert session notification', e);
    }
  }, [session, rememberSessionSeen]);

  const hasNotification = useCallback(
    (type: NotificationItem['type'], predicate?: (n: NotificationItem) => boolean) => {
      return notifications.some(n => n.type === type && (!predicate || predicate(n)));
    },
    [notifications]
  );

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(msg);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('gridlead_leads');
    if (saved) setLeads(JSON.parse(saved));
    else setLeads(MOCK_LEADS);
  }, []);

  // Restore seen session ids to avoid duplicate device notifications
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(SESSION_SEEN_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        sessionSeenRef.current = new Set(parsed);
      } catch (_e) {
        sessionSeenRef.current = new Set();
      }
    }
  }, []);

  // Clean up logout query params from URL (logged_out, _ts) for neatness after redirect.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('logged_out') || url.searchParams.has('_ts')) {
      url.searchParams.delete('logged_out');
      url.searchParams.delete('_ts');
      const clean = url.pathname + (url.search ? `?${url.searchParams.toString()}` : '') + url.hash;
      window.history.replaceState({}, document.title, clean);
    }
  }, []);

  const ensureFingerprint = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const existing = localStorage.getItem(SESSION_FP_KEY);
    if (existing) return existing;
    const fp = crypto.randomUUID();
    localStorage.setItem(SESSION_FP_KEY, fp);
    return fp;
  }, []);

  const sendSessionHeartbeat = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) return;
    const fp = ensureFingerprint();
    if (!fp) return;
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null;
    const accessToken = session.access_token;
    if (!accessToken) return;
    try {
      const { data, error } = await supabase.functions.invoke('session-heartbeat', {
        body: { fingerprint: fp, userAgent: navigator.userAgent, expiresAt },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;
      if (data?.revoked) {
        console.warn('Session revoked remotely, signing out');
        await supabase.auth.signOut({ scope: 'local' });
        window.location.replace('/?logged_out=1');
      }
    } catch (e) {
      console.warn('session heartbeat failed', e);
    }
  }, [ensureFingerprint]);

  // Heartbeat sessions periodically and on visibility/focus
  useEffect(() => {
    let interval: number | null = null;
    const kick = () => void sendSessionHeartbeat();
    if (session) {
      kick();
      interval = window.setInterval(kick, 5 * 60 * 1000);
      const onFocus = () => kick();
      const onVisible = () => document.visibilityState === 'visible' && kick();
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        if (interval) window.clearInterval(interval);
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVisible);
      };
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [session, sendSessionHeartbeat]);

  useEffect(() => {
    localStorage.setItem('gridlead_leads', JSON.stringify(leads));
  }, [leads]);

  const fetchNotifications = useCallback(
    async (uid: string) => {
      const [inboxRes, archiveRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', uid)
          .is('archived_at', null)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', uid)
          .not('archived_at', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      console.debug('[notif] fetchNotifications', {
        uid,
        inboxErr: inboxRes.error,
        archiveErr: archiveRes.error,
        inboxCount: inboxRes.data?.length,
        archiveCount: archiveRes.data?.length,
      });
      const inboxData = inboxRes.data || [];
      const archiveData = archiveRes.data || [];
      if (!inboxRes.error || !archiveRes.error) {
        const alreadySeenAgency = hasSeenAgencyApproved();
        const containsAgency = [...inboxData, ...archiveData].some((n: any) => n?.meta?.kind === 'agency_approved');
        if (containsAgency) markAgencyApprovedSeen();

        const mapRow = (n: any): NotificationItem => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          created_at: n.created_at,
          unread: !n.read_at,
          archived_at: n.archived_at || null,
          meta: n.meta || {},
        });

        const filteredInbox = inboxData.filter((n: any) => !(alreadySeenAgency && n?.meta?.kind === 'agency_approved')).map(mapRow);
        const filteredArchive = archiveData.filter((n: any) => !(alreadySeenAgency && n?.meta?.kind === 'agency_approved')).map(mapRow);

        setNotifications(filteredInbox);
        setArchivedNotifications(filteredArchive);
      }
    },
    []
  );

  const markNotificationRead = useCallback(async (id: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, unread: false } : n)));
    setArchivedNotifications(prev => prev.map(n => (n.id === id ? { ...n, unread: false } : n)));
    if (!uid) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', uid);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    if (!uid) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', uid)
      .is('archived_at', null);
  }, []);

  const archiveNotification = useCallback(async (id: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    const archivedAt = new Date().toISOString();
    setNotifications(prev => {
      const target = prev.find(n => n.id === id);
      if (!target) return prev;
      if (target?.meta?.kind === 'agency_approved') markAgencyApprovedSeen();
      const updated = { ...target, archived_at: archivedAt };
      setArchivedNotifications(prevArch => [updated, ...prevArch]);
      return prev.filter(n => n.id !== id);
    });
    if (!uid) return;
    await supabase.from('notifications').update({ archived_at: archivedAt }).eq('id', id).eq('user_id', uid);
  }, []);

  const archiveAllNotifications = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    const archivedAt = new Date().toISOString();
    if (notifications.some(n => n.meta?.kind === 'agency_approved')) {
      markAgencyApprovedSeen();
    }
    setArchivedNotifications(prev => [...notifications.map(n => ({ ...n, archived_at: archivedAt })), ...prev]);
    setNotifications([]);
    if (!uid) return;
    await supabase
      .from('notifications')
      .update({ archived_at: archivedAt })
      .eq('user_id', uid)
      .is('archived_at', null);
  }, [notifications]);

  const deleteNotification = useCallback(async (id: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    setArchivedNotifications(prev => prev.filter(n => n.id !== id));
    if (!uid) return;
    await supabase.from('notifications').delete().eq('id', id).eq('user_id', uid);
  }, []);

  const deleteAllArchived = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    setArchivedNotifications([]);
    if (!uid) return;
    await supabase.from('notifications').delete().eq('user_id', uid).not('archived_at', 'is', null);
  }, []);

  const createNotification = useCallback(
    async (type: NotificationItem['type'], title: string, body: string, meta: Record<string, any> = {}) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return;
      // Certain event types are noisy as persistent in-app items and are
      // better surfaced as ephemeral toasts. Show a toast and skip DB insert
      // for those types.
      if (type === 'send_failed' || type === 'gmail_disconnected') {
        showToast(title || body || 'Notification');
        return;
      }

      // Insert and return the created row so we can optimistically update UI
      const insert = await supabase.from('notifications').insert({
        user_id: uid,
        type,
        title,
        body,
        meta,
        channel: 'in_app',
      }).select().maybeSingle();
      // If insert returned a row, add it to local notifications state immediately.
      const created = insert?.data || null;
      if (created) {
        const item: NotificationItem = {
          id: created.id,
          type: created.type,
          title: created.title,
          body: created.body,
          created_at: created.created_at,
          unread: !created.read_at,
          archived_at: created.archived_at || null,
          meta: created.meta || {},
        };
        setNotifications(prev => [item, ...prev].slice(0, 100));
      }
    },
    []
  );

  // Keep a ref to the latest createNotification so an early-installed
  // service-worker message listener can persist notifications even before
  // React effects that depend on session run.
  const createNotificationRef = React.useRef(createNotification);
  React.useEffect(() => {
    createNotificationRef.current = createNotification;
  }, [createNotification]);

  // Fetch profile and leads when session changes
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session) {
        setProfile(null);
        setLeads(MOCK_LEADS);
        setNotifications(SAMPLE_NOTIFICATIONS);
        setArchivedNotifications([]);
        setNotificationTab('inbox');
        setNotifPrefs(notifDefaults);
        goalNotifiedRef.current = false;
        return;
      }
      setProfileLoading(true);
      setProfileError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        // If table is missing (42P01), don't block the app—mark onboarding as complete and surface the error.
        if (error.code === '42P01') {
          setProfile({ id: session.user.id, onboarding_completed: true });
          setProfileError('Profiles table missing in Supabase. Run sql/profiles.sql.');
        } else {
          setProfileError(error.message);
          setProfile(null);
        }
      } else {
        setProfile(data as Profile | null);
      }
      setProfileLoading(false);

      // Load notification preferences
      const { data: notifRow } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (notifRow) {
        setNotifPrefs({
          leads: notifRow.leads ?? notifDefaults.leads,
          replies: notifRow.replies ?? notifDefaults.replies,
          weekly: notifRow.weekly ?? notifDefaults.weekly,
          browser: notifRow.browser ?? notifDefaults.browser,
          send_failed: notifRow.send_failed ?? notifDefaults.send_failed,
          gmail_disconnected: notifRow.gmail_disconnected ?? notifDefaults.gmail_disconnected,
          goal_hit: notifRow.goal_hit ?? notifDefaults.goal_hit,
          lead_assigned: notifRow.lead_assigned ?? notifDefaults.lead_assigned,
          pipeline_threshold: notifRow.pipeline_threshold ?? notifDefaults.pipeline_threshold,
        });
      } else {
        await supabase.from('user_notifications').upsert({ user_id: session.user.id, ...notifDefaults });
        setNotifPrefs(notifDefaults);
        goalNotifiedRef.current = false;
      }
    };

    void fetchProfile();
  }, [session]);

  // Listen for messages from the service worker (push events forwarded by SW).
  // This listener is installed once (empty deps) so it can receive messages
  // immediately after the SW claims the page — no refresh required.
  useEffect(() => {
    const onSWMessage = (ev: MessageEvent) => {
      try {
        const msg = ev.data || {};
        if (msg.type === 'push:received') {
          const payload = msg.payload || {};
          console.debug('[SW] push payload received', payload);
          const meta = payload.meta || {};
          const serverId = meta?.serverNotificationId || null;

          if (serverId) {
            // If server already created the notification (and we have its id),
            // avoid calling createNotification (which would insert a duplicate).
            setNotifications(prev => {
              if (prev.some(n => n.id === serverId)) return prev;
              const item: NotificationItem = {
                id: serverId,
                type: (payload.type as any) || 'reply',
                title: payload.title || 'Notification',
                body: payload.body || '',
                created_at: new Date().toISOString(),
                unread: true,
                meta,
              };
              return [item, ...prev].slice(0, 100);
            });
          } else {
            const item: NotificationItem = {
              id: `push-${Date.now()}`,
              type: (payload.type as any) || 'reply',
              title: payload.title || 'Notification',
              body: payload.body || '',
              created_at: new Date().toISOString(),
              unread: true,
              meta,
            };
            setNotifications(prev => [item, ...prev].slice(0, 100));
            // Persist to server-side notifications using the ref to the latest
            // createNotification callback. The callback itself will check session.
            try {
              console.debug('[SW] persisting push to server', { type: item.type, meta: item.meta });
              createNotificationRef.current?.(item.type, item.title, item.body, item.meta || {});
            } catch (e) {
              console.warn('Failed to persist push notification', e);
            }
          }
        }
      } catch (e) {
        console.warn('SW message handler error', e);
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSWMessage as any);
    }
    return () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSWMessage as any);
      }
    };
  }, []);

  useEffect(() => {
    const fetchLeads = async () => {
      if (!session) return;
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', session.user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (!error && data) {
        const mapped = data.map((row: any) => ({
          id: row.id,
          placeId: row.place_id || undefined,
          name: row.name,
          category: row.category || 'Business',
          rating: Number(row.rating) || 0,
          lastScan: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : 'Recently',
          createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
          updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
          website: row.website || 'No website',
          email: row.email || undefined,
          address: row.address || undefined,
          lat: row.lat ?? undefined,
          lng: row.lng ?? undefined,
          status: row.status || 'pending',
          sentAt: row.sent_at ? new Date(row.sent_at).getTime() : undefined,
          draftSubject: row.draft_subject || undefined,
          draftBody: row.draft_body || undefined,
          score: {
            design: row.score_design ?? 50,
            performance: row.score_performance ?? 50,
            reviews: row.score_reviews ?? 50,
            trust: row.score_trust ?? 50,
          },
          notes: row.notes || '',
          checklist: {
            mobileOptimization: row.checklist_mobile_optimization ?? undefined,
            sslCertificate: row.checklist_ssl_certificate ?? undefined,
            seoPresence: row.checklist_seo_presence ?? undefined,
            conversionFlow: row.checklist_conversion_flow ?? undefined,
            hasGoogleReviews: row.checklist_google_reviews ?? undefined,
            hasRender: row.checklist_render ?? undefined,
          }
        })) as Lead[];
        setLeads(mapped);
      }
    };
    void fetchLeads();
  }, [session]);

  // Goal hit / pipeline threshold notifications
  useEffect(() => {
    if (!session || !profile?.monthly_goal) return;
    const wins = leads.filter(l => l.status === 'won').length;
    const currentRevenue = wins * avgDealSize;
    const goal = profile.monthly_goal || 0;
    const pipelineValue = leads.filter(l => ['sent','responded','won'].includes(l.status)).length * avgDealSize;

    if (
      notifPrefs.goal_hit &&
      currentRevenue >= goal &&
      goal > 0 &&
      !goalNotifiedRef.current &&
      !hasNotification('goal_hit', n => (n.meta?.goal ?? null) === goal)
    ) {
      goalNotifiedRef.current = true;
      void createNotification('goal_hit', 'Goal achieved', `You hit $${goal.toLocaleString()} in revenue.`, {
        revenue: currentRevenue,
        goal,
      });
    }

    if (
      notifPrefs.pipeline_threshold &&
      goal > 0 &&
      pipelineValue < goal * 0.3 &&
      !hasNotification('pipeline_threshold', n => (n.meta?.goal ?? null) === goal)
    ) {
      void createNotification('pipeline_threshold', 'Pipeline low', `Pipeline dropped below 30% of goal. Current: $${pipelineValue.toLocaleString()}`, {
        pipelineValue,
        goal,
      });
    }

    // Reset if goal changes downward
    if (goal > 0 && currentRevenue < goal) {
      goalNotifiedRef.current = false;
    }
  }, [leads, profile?.monthly_goal, notifPrefs.goal_hit, notifPrefs.pipeline_threshold, session, createNotification, hasNotification]);

  // Notifications realtime feed
  useEffect(() => {
    const setup = async () => {
      if (!session) {
        setNotifications(SAMPLE_NOTIFICATIONS);
        setArchivedNotifications([]);
        setNotificationTab('inbox');
        if (notifChannelRef.current) {
          notifChannelRef.current.unsubscribe();
          notifChannelRef.current = null;
        }
        return;
      }
      await fetchNotifications(session.user.id);

      if (notifChannelRef.current) {
        notifChannelRef.current.unsubscribe();
        notifChannelRef.current = null;
      }

      // Primary subscription: filtered by user_id on the server to reduce noise.
      const channel = supabase
        .channel('notifications-feed')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
          (payload) => {
            const row: any = payload.new;
            if (row?.meta?.kind === 'agency_approved' && hasSeenAgencyApproved()) {
              return; // already seen; avoid re-showing on refresh
            }
            if (row.archived_at) return; // new rows should default to inbox; skip if already archived
            setNotifications(prev => {
              if (prev.some(n => n.id === row.id)) return prev;
              const next = [
                {
                  id: row.id,
                  type: row.type,
                  title: row.title,
                  body: row.body,
                  created_at: row.created_at,
                  unread: !row.read_at,
                  archived_at: row.archived_at || null,
                  meta: row.meta || {},
                },
                ...prev,
              ].slice(0, 100);
              return next;
            });
            if (row?.meta?.kind === 'agency_approved') {
              markAgencyApprovedSeen();
            }
          }
        )
        .subscribe();

      // Fallback subscription: listen to all notifications INSERTs and filter
      // client-side. This catches cases where server-side filtering or mismatched
      // user_id values prevent the filtered channel from delivering events.
      const fallback = supabase
        .channel('notifications-feed-all')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload) => {
            const row: any = payload.new;
            try {
              if (row.user_id !== session.user.id) return;
            } catch (e) {
              return;
            }
            if (row?.meta?.kind === 'agency_approved' && hasSeenAgencyApproved()) {
              return;
            }
            if (row.archived_at) return;
            setNotifications(prev => {
              if (prev.some(n => n.id === row.id)) return prev;
              const next = [
                {
                  id: row.id,
                  type: row.type,
                  title: row.title,
                  body: row.body,
                  created_at: row.created_at,
                  unread: !row.read_at,
                  archived_at: row.archived_at || null,
                  meta: row.meta || {},
                },
                ...prev,
              ].slice(0, 100);
              return next;
            });
            if (row?.meta?.kind === 'agency_approved') {
              markAgencyApprovedSeen();
            }
          }
        )
        .subscribe();

      notifChannelRef.current = channel;
      // Store fallback in a symbol on the channel ref so we can unsubscribe both
      // when cleaning up.
      (notifChannelRef as any).fallback = fallback;
    };
    void setup();

    return () => {
      if (notifChannelRef.current) {
        // unsubscribe primary channel
        notifChannelRef.current.unsubscribe();
        // unsubscribe fallback if present
        try {
          const fb = (notifChannelRef as any).fallback;
          if (fb) fb.unsubscribe();
        } catch (e) {
          /* ignore */
        }
        notifChannelRef.current = null;
      }
    };
  }, [session, fetchNotifications]);

  // Notify when a new device/session is added (once per fingerprint/id)
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('user-sessions-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_sessions', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          const row: any = payload.new;
          const key = row?.fingerprint || row?.id;
          if (!key) return;
          if (sessionSeenRef.current.has(key)) return;
          const ua = shortUserAgent(row?.user_agent);
          void addSessionNotification(key, ua || null);
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [session, createNotification, rememberSessionSeen]);

  // Fallback: on load, inspect recent sessions and emit notifications for unseen ones
  useEffect(() => {
    const syncRecentSessions = async () => {
      if (!session) return;
      const { data, error } = await supabase
        .from('user_sessions')
        .select('id,fingerprint,user_agent')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error || !data) return;
      data.forEach((row: any) => {
        const key = row?.fingerprint || row?.id;
        if (!key || sessionSeenRef.current.has(key)) return;
        const ua = shortUserAgent(row?.user_agent);
        void addSessionNotification(key, ua || null);
      });
    };
    void syncRecentSessions();
  }, [session, addSessionNotification]);

  // If user is logged in but profile is incomplete, keep onboarding visible
  useEffect(() => {
    if (session && !profileLoading && (!profile || !profile.onboarding_completed)) {
      setShowOnboarding(true);
      setOnboardingMode('login');
    }
  }, [session, profile, profileLoading]);

  // Initialize auth session and listen for changes
  useEffect(() => {
    const initAuth = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const hasAuthCallback = url.pathname === '/auth/callback' || !!code;

      if (hasAuthCallback && code) {
        setAuthProcessing(true);
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setAuthError(error.message);
        } else {
          setSession(data.session);
          // Session will be set via auth listener as well.
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, document.title, url.pathname);
          setShowOnboarding(false);
        }
        setAuthProcessing(false);
      }

      const { data, error } = await supabase.auth.getSession();
      if (!error) {
        setSession(data.session);
      } else {
        setAuthError(error.message);
      }
      setAuthLoading(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Log auth state transitions for debugging logout races
      logAuthState(event, newSession);
      setSession(newSession);
      if (!newSession) {
        setActiveView(AppView.DASHBOARD);
        setProfile(null);
      }
    });

    void initAuth();
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleStartOnboarding = (mode: 'signup' | 'login' = 'signup') => {
    setOnboardingMode(mode);
    setShowOnboarding(true);
  };

  const handleOnboardingCancel = async () => {
    // Use robustLogout to ensure client state and service workers are cleared
    setShowOnboarding(false);
    await robustLogout({ redirectTo: '/' });
  };

  const handleOnboardingComplete = () => {
    const finish = async () => {
      if (session) {
        const { data, error } = await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', session.user.id)
          .select('*')
          .single();
        if (!error && data) {
          setProfile(data as Profile);
        }
      }
      setShowOnboarding(false);
      setActiveView(AppView.DASHBOARD);
    };
    void finish();
  };

  const handleEmailAuth = async (mode: 'signup' | 'login', email: string, password: string) => {
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      setAuthError(error?.message || 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError(null);
    const baseUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    const redirectTo = `${baseUrl}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) setAuthError(error.message);
  };

  const handleProfileSave = async (form: {
    display_name: string;
    agency_name: string;
    monthly_goal?: number;
  }) => {
    if (!session) return { error: 'No session' };
    const payload = {
      id: session.user.id,
      ...form,
    };
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();
    if (!error) {
      setProfile(data as Profile);
      // Ensure notification prefs exist with defaults
      const { data: existingNotif } = await supabase
        .from('user_notifications')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!existingNotif) {
        await supabase.from('user_notifications').insert({
          user_id: session.user.id,
          leads: true,
          replies: true,
          weekly: false,
          browser: false,
          send_failed: true,
          gmail_disconnected: true,
          goal_hit: true,
          lead_assigned: true,
          pipeline_threshold: false,
        });
      }
    }
    return { error: error?.message };
  };

  const handleSaveMonthlyGoal = async (goal: number) => {
    if (!session) return { error: 'No session' };
    const { data, error } = await supabase
      .from('profiles')
      .update({ monthly_goal: goal })
      .eq('id', session.user.id)
      .select('*')
      .single();
    if (!error) {
      setProfile(data as Profile);
    }
    return { error: error?.message };
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(async () => {
      await robustLogout({ redirectTo: '/' });
      setSession(null);
      setShowOnboarding(false);
      setIsLoggingOut(false);
    }, 400);
  };

  const addLead = async (newLead: Lead) => {
    if (!session) {
      setLeads(prev => [newLead, ...prev]);
      return;
    }
    const currentPlanLimits = getPlanLimits(profile?.plan);
    if (isOverLeadLimit(profile?.plan, profile?.leads_used_this_month ?? 0)) {
      setProfileError(`Lead limit reached on your ${currentPlanLimits.label} plan. Upgrade to continue adding leads.`);
      return;
    }
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(newLead.id);
    const payload: any = {
      user_id: session.user.id,
      place_id: newLead.placeId ?? null,
      name: newLead.name,
      category: newLead.category,
      rating: newLead.rating,
      website: newLead.website,
      address: newLead.address,
      lat: newLead.lat,
      lng: newLead.lng,
      status: newLead.status,
      draft_subject: newLead.draftSubject,
      draft_body: newLead.draftBody,
      sent_at: newLead.sentAt ? new Date(newLead.sentAt).toISOString() : null,
      notes: newLead.notes,
      score_design: newLead.score?.design,
      score_performance: newLead.score?.performance,
      score_reviews: newLead.score?.reviews,
      score_trust: newLead.score?.trust,
    };
    if (isUuid) {
      payload.id = newLead.id;
    }
    // Log payload for debugging (make sure place_id is included)
    console.debug('leads.upsert payload', payload);

    // Use safe select-then-insert/update flow to avoid ON CONFLICT errors (42P10)
    let data = null;
    let error = null;
    try {
      if (payload.place_id) {
        // If place_id is present, check for existing lead with that unique key
        const { data: existing, error: selErr } = await supabase
          .from('leads')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('place_id', payload.place_id)
          .maybeSingle();
        if (selErr) {
          console.error('leads.select error', JSON.stringify(selErr));
        }

        if (existing && existing.id) {
          const { data: updated, error: updErr } = await supabase
            .from('leads')
            .update(payload)
            .eq('id', existing.id)
            .select('*')
            .single();
          data = updated;
          error = updErr;
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from('leads')
            .insert(payload)
            .select('*')
            .single();
          data = inserted;
          error = insErr;
        }
      } else if (payload.id) {
        // If we have an id, upsert on id is safe
        const res = await supabase.from('leads').upsert(payload, { onConflict: 'id' }).select('*').single();
        data = res.data;
        error = res.error;
      } else {
        // Fallback: plain insert
        const { data: inserted, error: insErr } = await supabase
          .from('leads')
          .insert(payload)
          .select('*')
          .single();
        data = inserted;
        error = insErr;
      }
    } catch (err) {
      console.error('leads.upsert exception', err);
      error = err as any;
    }

    if (error) console.error('leads.upsert error', JSON.stringify(error));
    if (!error && data) {
      setLeads(prev => [{
        ...newLead,
        id: data.id,
      }, ...prev.filter(l => l.id !== data.id)]);
      // Avoid optimistic double-counting: refresh profile from server so
      // the DB trigger (enforce_lead_quota) is authoritative for the
      // monthly counter.
      try {
        const { data: refreshed, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!profErr && refreshed) setProfile(refreshed as any);
      } catch (e) {
        console.warn('Failed to refresh profile after lead insert', e);
      }
      if (notifPrefs.leads) {
        void createNotification('lead', 'New lead added', `Lead "${newLead.name}" was added.`, { leadId: data.id });
      }
    } else {
      // Handle DB errors (e.g., DB trigger blocking due to lead quota)
      const errMsg = (error?.message || '').toString();
      if (/lead limit reached/i.test(errMsg)) {
        setProfileError(`Lead limit reached on your ${currentPlanLimits.label} plan. Upgrade to continue adding leads.`);
      } else if (errMsg) {
        setProfileError(errMsg);
      } else {
        setProfileError('Failed to add lead.');
      }
      // Do not optimistically keep the lead in the UI when server rejected it.
    }
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const prevLead = leads.find(l => l.id === id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    if (!session) return;
    const payload: any = {};
    if (updates.status) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.draftSubject !== undefined) payload.draft_subject = updates.draftSubject;
    if (updates.draftBody !== undefined) payload.draft_body = updates.draftBody;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.sentAt !== undefined) payload.sent_at = updates.sentAt ? new Date(updates.sentAt).toISOString() : null;
    if (updates.score) {
      payload.score_design = updates.score.design;
      payload.score_performance = updates.score.performance;
      payload.score_reviews = updates.score.reviews;
      payload.score_trust = updates.score.trust;
    }
    if (updates.checklist) {
      payload.checklist_mobile_optimization = updates.checklist.mobileOptimization ?? null;
      payload.checklist_ssl_certificate = updates.checklist.sslCertificate ?? null;
      payload.checklist_seo_presence = updates.checklist.seoPresence ?? null;
      payload.checklist_conversion_flow = updates.checklist.conversionFlow ?? null;
      payload.checklist_google_reviews = updates.checklist.hasGoogleReviews ?? null;
      payload.checklist_render = updates.checklist.hasRender ?? null;
    }
    const { data: updatedRow, error: updateErr } = await supabase.from('leads').update(payload).eq('id', id).eq('user_id', session.user.id).select('*').single();

    // Refresh authoritative row from server so client sees archived_at and any trigger side-effects
    try {
      if (!updateErr && updatedRow && updatedRow.id) {
        const row = updatedRow as any;
        const mapped = {
          id: row.id,
          placeId: row.place_id || undefined,
          name: row.name,
          category: row.category || 'Business',
          rating: Number(row.rating) || 0,
          lastScan: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : 'Recently',
          createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
          updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
          website: row.website || 'No website',
          email: row.email || undefined,
          address: row.address || undefined,
          lat: row.lat ?? undefined,
          lng: row.lng ?? undefined,
          status: row.status || 'pending',
          sentAt: row.sent_at ? new Date(row.sent_at).getTime() : undefined,
          draftSubject: row.draft_subject || undefined,
          draftBody: row.draft_body || undefined,
          score: {
            design: row.score_design ?? 50,
            performance: row.score_performance ?? 50,
            reviews: row.score_reviews ?? 50,
            trust: row.score_trust ?? 50,
          },
          notes: row.notes || '',
          checklist: {
            mobileOptimization: row.checklist_mobile_optimization ?? undefined,
            sslCertificate: row.checklist_ssl_certificate ?? undefined,
            seoPresence: row.checklist_seo_presence ?? undefined,
            conversionFlow: row.checklist_conversion_flow ?? undefined,
            hasGoogleReviews: row.checklist_google_reviews ?? undefined,
            hasRender: row.checklist_render ?? undefined,
          }
        } as Lead;
        setLeads(prev => prev.map(l => l.id === id ? mapped : l));
      }
    } catch (e) {
      console.warn('Failed to refresh lead after update', e);
    }

    // Notifications: outreach reply (responded/won)
    const nextStatus = updates.status;
    if (notifPrefs.replies && nextStatus && prevLead && !['responded', 'won'].includes(prevLead.status) && ['responded', 'won'].includes(nextStatus)) {
      void createNotification(
        'reply',
        'Outreach reply received',
        `Lead "${prevLead.name}" replied.`,
        { leadId: id, status: nextStatus }
      );
    }
  };

  const deleteLead = async (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    if (!session) return;
    const { error } = await supabase.from('leads').delete().eq('id', id).eq('user_id', session.user.id);
    if (error) {
      console.error('Failed to delete lead', error);
      return;
    }
    // Refresh profile from server so the monthly counter reflects the DB trigger
    try {
      const { data: refreshed, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!profErr && refreshed) setProfile(refreshed as any);
    } catch (e) {
      console.warn('Failed to refresh profile after lead delete', e);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case AppView.DASHBOARD:
        return <Dashboard leads={leads} onNavigate={setActiveView} profile={profile} onSaveGoal={handleSaveMonthlyGoal} />;
      case AppView.DISCOVERY:
        return <HeroDiscovery onLeadAdd={addLead} onNotice={showToast} />;
      case AppView.QUEUE:
        return <ReviewQueue leads={leads} onUpdateLead={updateLead} onDeleteLead={deleteLead} />;
      case AppView.CAMPAIGNS:
        return <OutreachBuilder leads={leads} onUpdateLead={updateLead} onDeleteLead={deleteLead} profile={profile} />;
      case AppView.SETTINGS:
        return <Settings 
          onLogout={handleLogout} 
          profile={profile}
          userName={profile?.display_name || session?.user.user_metadata?.full_name || session?.user.email?.split('@')[0]}
          userEmail={session?.user.email || ''}
          userAvatarUrl={session?.user.user_metadata?.avatar_url}
          agencyName={profile?.agency_name}
          authProvider={(session?.user.app_metadata as any)?.provider}
        />;
      default:
        return <Dashboard leads={leads} onNavigate={setActiveView} />;
    }
  };

  if (isLoggingOut) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
        <div className="w-12 h-12 border-4 border-slate-100 dark:border-slate-800 border-t-slate-900 dark:border-t-slate-400 rounded-full animate-spin" />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Signing out safely...</p>
      </div>
    );
  }

  const needsOnboarding = !!session && !profileLoading && (!profile || !profile.onboarding_completed);

  useEffect(() => {
    if (session && !needsOnboarding) {
      const storedView = typeof window !== 'undefined'
        ? (() => {
            const raw = localStorage.getItem(RETURN_VIEW_KEY);
            if (!raw) return null;
            return raw.toLowerCase() as AppView;
          })()
        : null;
      if (storedView) {
        setActiveView(storedView);
        localStorage.removeItem(RETURN_VIEW_KEY);
      }
    }
  }, [session, needsOnboarding]);

  // Realtime profile listener to keep status fresh (for agency approvals, etc.)
  useEffect(() => {
    if (!session) {
      if (profileChannelRef.current) {
        profileChannelRef.current.unsubscribe();
        profileChannelRef.current = null;
      }
      return;
    }
    if (profileChannelRef.current) {
      profileChannelRef.current.unsubscribe();
      profileChannelRef.current = null;
    }
    const ch = supabase
      .channel('profile-self')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        (payload) => {
          if (payload.new) {
            setProfile(payload.new as Profile);
          }
        },
      )
      .subscribe();
    profileChannelRef.current = ch;
    return () => {
      if (profileChannelRef.current) {
        profileChannelRef.current.unsubscribe();
        profileChannelRef.current = null;
      }
    };
  }, [session]);

  // Fire a notification when Agency+ waitlist is approved
  useEffect(() => {
    const currentStatus = profile?.agency_waitlist_status || null;
    const approved = !!profile?.agency_approved || (currentStatus || '').toLowerCase() === 'approved';
    const prev = lastAgencyStatusRef.current;
    if (approved && prev !== 'approved' && !agencyNotifSentRef.current && !hasSeenAgencyApproved()) {
      lastAgencyStatusRef.current = 'approved';
      agencyNotifSentRef.current = true;
      void (async () => {
        try {
          if (!session) return;
          const { data, error } = await supabase.from('notifications').insert({
            user_id: session.user.id,
            type: 'info',
            title: 'Agency+ approved',
            body: 'Your Agency+ request was approved. You can upgrade now.',
            meta: { kind: 'agency_approved' },
          }).select().single();
          markAgencyApprovedSeen();
          const row = data as any;
          const newNotif = {
            id: row?.id || `${Date.now()}`,
            type: 'info' as const,
            title: 'Agency+ approved',
            body: 'Your Agency+ request was approved. You can upgrade now.',
            created_at: row?.created_at || new Date().toISOString(),
            unread: true,
            meta: { kind: 'agency_approved' },
          };
          setNotifications(prev => {
            if (prev.some(n => n.meta?.kind === 'agency_approved')) return prev;
            return [newNotif, ...prev].slice(0, 100);
          });
          if (error) console.warn('Notification insert error', error);
        } catch (e) {
          console.warn('Failed to insert agency approval notification', e);
        }
      })();
    } else {
      lastAgencyStatusRef.current = currentStatus;
    }
  }, [profile, session, needsOnboarding]);

  if (authLoading || authProcessing || profileLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
        <div className="w-12 h-12 border-4 border-slate-100 dark:border-slate-800 border-t-slate-900 dark:border-t-slate-400 rounded-full animate-spin" />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Preparing workspace...</p>
      </div>
    );
  }

  if (!session) {
    return showOnboarding ? (
      <Onboarding 
        mode={onboardingMode}
        onComplete={handleOnboardingComplete} 
        onCancel={handleOnboardingCancel}
        onGoogleAuth={handleGoogleAuth}
        onEmailAuth={handleEmailAuth}
        onProfileSave={handleProfileSave}
        hasSession={!!session}
        initialProfile={{
          display_name: profile?.display_name || '',
          agency_name: profile?.agency_name || '',
          monthly_goal: profile?.monthly_goal || ''
        }}
        authError={authError}
        submitting={authSubmitting}
        profileError={profileError}
      />
    ) : (
      <LandingPage onGetStarted={() => handleStartOnboarding('signup')} onLogin={() => handleStartOnboarding('login')} />
    );
  }

  if (needsOnboarding) {
    return (
      <Onboarding 
        mode={onboardingMode}
        onComplete={handleOnboardingComplete} 
        onCancel={handleOnboardingCancel}
        onGoogleAuth={handleGoogleAuth}
        onEmailAuth={handleEmailAuth}
        onProfileSave={handleProfileSave}
        hasSession={!!session}
        initialProfile={{
          display_name: profile?.display_name || '',
          agency_name: profile?.agency_name || '',
          monthly_goal: profile?.monthly_goal || ''
        }}
        authError={authError}
        submitting={authSubmitting}
        profileError={profileError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all duration-1000">
      <main className="min-h-screen pb-32 relative z-10">
        <div className="animate-in fade-in duration-700 slide-in-from-bottom-2">
          {renderView()}
        </div>
      </main>
          <NotificationCenter
        open={notificationsOpen}
        inbox={notifications}
        archive={archivedNotifications}
        activeTab={notificationTab}
        onTabChange={setNotificationTab}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={markAllNotificationsRead}
        onArchiveAll={archiveAllNotifications}
        onDeleteAll={deleteAllArchived}
        onArchive={archiveNotification}
        onMarkRead={markNotificationRead}
        onDelete={deleteNotification}
      />
      {/* Global ephemeral toast (for send_failed, gmail_disconnected, etc.) */}
      {toast && (
        <div className="fixed top-8 right-8 z-[100] animate-in slide-in-from-right-10 duration-500">
          <div className="bg-[#0f172a] dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 dark:border-slate-100">
            <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center" />
            <span className="text-xs font-bold uppercase tracking-widest">{toast}</span>
          </div>
        </div>
      )}
      <NavigationDock 
        activeView={activeView} 
        setActiveView={setActiveView} 
        onOpenNotifications={() => setNotificationsOpen(prev => !prev)} 
        unreadCount={notifications.filter(n => n.unread).length}
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.05] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] z-0" />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
