
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

  const hasNotification = useCallback(
    (type: NotificationItem['type'], predicate?: (n: NotificationItem) => boolean) => {
      return notifications.some(n => n.type === type && (!predicate || predicate(n)));
    },
    [notifications]
  );

  useEffect(() => {
    const saved = localStorage.getItem('gridlead_leads');
    if (saved) setLeads(JSON.parse(saved));
    else setLeads(MOCK_LEADS);
  }, []);

  useEffect(() => {
    localStorage.setItem('gridlead_leads', JSON.stringify(leads));
  }, [leads]);

  const fetchNotifications = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        setNotifications(
          data.map((n: any) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            created_at: n.created_at,
            unread: !n.read_at,
            meta: n.meta || {},
          }))
        );
      }
    },
    []
  );

  const markNotificationRead = useCallback(async (id: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, unread: false } : n)));
    if (!uid) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', uid);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    if (!uid) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid);
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (!uid) return;
    await supabase.from('notifications').delete().eq('id', id).eq('user_id', uid);
  }, []);

  const createNotification = useCallback(
    async (type: NotificationItem['type'], title: string, body: string, meta: Record<string, any> = {}) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return;
      await supabase.from('notifications').insert({
        user_id: uid,
        type,
        title,
        body,
        meta,
        channel: 'in_app',
      });
    },
    []
  );

  // Fetch profile and leads when session changes
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session) {
        setProfile(null);
        setLeads(MOCK_LEADS);
        setNotifications(SAMPLE_NOTIFICATIONS);
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

  useEffect(() => {
    const fetchLeads = async () => {
      if (!session) return;
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', session.user.id)
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
        if (notifChannelRef.current) {
          notifChannelRef.current.unsubscribe();
          notifChannelRef.current = null;
        }
        return;
      }
      await fetchNotifications(session.user.id);

      if (notifChannelRef.current) {
        notifChannelRef.current.unsubscribe();
      }
      const channel = supabase
        .channel('notifications-feed')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
          (payload) => {
            const row: any = payload.new;
            setNotifications(prev => [
              {
                id: row.id,
                type: row.type,
                title: row.title,
                body: row.body,
                created_at: row.created_at,
                unread: !row.read_at,
                meta: row.meta || {},
              },
              ...prev,
            ].slice(0, 100));
          }
        )
        .subscribe();
      notifChannelRef.current = channel;
    };
    void setup();

    return () => {
      if (notifChannelRef.current) {
        notifChannelRef.current.unsubscribe();
        notifChannelRef.current = null;
      }
    };
  }, [session, fetchNotifications]);

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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
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
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setShowOnboarding(false);
    setActiveView(AppView.DASHBOARD);
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
    const redirectTo = `${window.location.origin}/auth/callback`;
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
      await supabase.auth.signOut();
      setSession(null);
      setShowOnboarding(false);
      setIsLoggingOut(false);
    }, 800);
  };

  const addLead = async (newLead: Lead) => {
    if (!session) {
      setLeads(prev => [newLead, ...prev]);
      return;
    }
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(newLead.id);
    const payload: any = {
      user_id: session.user.id,
      place_id: newLead.placeId,
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
    const { data, error } = await supabase.from('leads').upsert(payload, { onConflict: 'id' }).select('*').single();
    if (!error && data) {
      setLeads(prev => [{
        ...newLead,
        id: data.id,
      }, ...prev.filter(l => l.id !== data.id)]);
      if (notifPrefs.leads) {
        void createNotification('lead', 'New lead added', `Lead "${newLead.name}" was added.`, { leadId: data.id });
      }
    } else {
      setLeads(prev => [newLead, ...prev]);
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
    await supabase.from('leads').update(payload).eq('id', id).eq('user_id', session.user.id);

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
    await supabase.from('leads').delete().eq('id', id).eq('user_id', session.user.id);
  };

  const renderView = () => {
    switch (activeView) {
      case AppView.DASHBOARD:
        return <Dashboard leads={leads} onNavigate={setActiveView} profile={profile} onSaveGoal={handleSaveMonthlyGoal} />;
      case AppView.DISCOVERY:
        return <HeroDiscovery onLeadAdd={addLead} />;
      case AppView.QUEUE:
        return <ReviewQueue leads={leads} onUpdateLead={updateLead} onDeleteLead={deleteLead} />;
      case AppView.CAMPAIGNS:
        return <OutreachBuilder leads={leads} onUpdateLead={updateLead} onDeleteLead={deleteLead} />;
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
        notifications={notifications}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={markAllNotificationsRead}
        onMarkRead={markNotificationRead}
        onDelete={deleteNotification}
      />
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
