
import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import NavigationDock from './components/NavigationDock';
import HeroDiscovery from './components/HeroDiscovery';
import ReviewQueue from './components/ReviewQueue';
import OutreachBuilder from './components/OutreachBuilder';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import LandingPage from './components/LandingPage';
import Onboarding from './components/Onboarding';
import { AppView, Lead, Profile } from './types';
import { MOCK_LEADS } from './constants';
import { ThemeProvider } from './ThemeContext';
import { supabase } from './lib/supabaseClient';

const AppContent: React.FC = () => {
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

  useEffect(() => {
    const saved = localStorage.getItem('gridlead_leads');
    if (saved) setLeads(JSON.parse(saved));
    else setLeads(MOCK_LEADS);
  }, []);

  useEffect(() => {
    localStorage.setItem('gridlead_leads', JSON.stringify(leads));
  }, [leads]);

  // Fetch profile and leads when session changes
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session) {
        setProfile(null);
        setLeads(MOCK_LEADS);
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
        })) as Lead[];
        setLeads(mapped);
      }
    };
    void fetchLeads();
  }, [session]);

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
    } else {
      setLeads(prev => [newLead, ...prev]);
    }
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
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
    await supabase.from('leads').update(payload).eq('id', id).eq('user_id', session.user.id);
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
      <NavigationDock activeView={activeView} setActiveView={setActiveView} />
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
