
import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  Mail, 
  Zap, 
  ShieldCheck, 
  Search, 
  ListFilter, 
  Send,
  CheckCircle2,
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  X,
  Gauge,
  MousePointer2,
  Shield
} from 'lucide-react';
import { startGmailOAuth } from '../services/gmailAuth';
import { supabase } from '../lib/supabaseClient';

interface OnboardingProps {
  mode: 'signup' | 'login';
  onComplete: () => void;
  onCancel: () => void;
  onGoogleAuth: () => Promise<void>;
  onEmailAuth: (mode: 'signup' | 'login', email: string, password: string) => Promise<void>;
  onProfileSave: (profile: { display_name: string; agency_name: string; monthly_goal?: number; }) => Promise<{ error?: string | null } | void>;
  hasSession?: boolean;
  initialProfile?: {
    display_name?: string | number;
    agency_name?: string | number;
    monthly_goal?: string | number;
  };
  authError?: string | null;
  profileError?: string | null;
  submitting?: boolean;
}

const Onboarding: React.FC<OnboardingProps> = ({ mode: initialMode, onComplete, onCancel, onGoogleAuth, onEmailAuth, onProfileSave, hasSession = false, initialProfile, authError, profileError, submitting }) => {
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode);
  const [step, setStep] = useState(hasSession ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(initialProfile?.display_name?.toString() || '');
  const [agencyName, setAgencyName] = useState(initialProfile?.agency_name?.toString() || '');
  const [monthlyGoal, setMonthlyGoal] = useState(initialProfile?.monthly_goal?.toString() || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailAccounts, setGmailAccounts] = useState<{ email: string; avatar_url?: string | null }[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const GMAIL_PENDING_KEY = 'gridlead_gmail_pending';
  
  // Progress tracking for tutorial
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const DURATION = 5000; 
  const INTERVAL = 30; 

  const tutorialCards = [
    {
      title: "Signal Mining",
      desc: "We scan web tech stacks, SEO hints, and visual debt to surface leads worth pitching.",
      icon: Search,
      color: "text-blue-500"
    },
    {
      title: "AI Audits",
      desc: "Perf, UX, and SEO checks generate proof points and personalized talking tracks.",
      icon: ListFilter,
      color: "text-indigo-500"
    },
    {
      title: "Outreach Studio",
      desc: "Send context-rich emails with rotation-safe deliverability and reply tracking.",
      icon: Send,
      color: "text-amber-500"
    }
  ];

  const stopTutorialTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const goToTutorialIndex = (nextIndex: number) => {
    const bounded = Math.min(Math.max(0, nextIndex), tutorialCards.length - 1);
    setProgress(0);
    setTutorialIndex(bounded);
  };

  useEffect(() => {
    if (step === 3) {
      // Reset to first module each time we enter the tutorial step.
      setTutorialIndex(0);
      setProgress(0);
    } else {
      stopTutorialTimer();
    }
  }, [step]);

  useEffect(() => {
    if (step !== 3) return;
    stopTutorialTimer();
    setProgress(0);

    const intervalId = window.setInterval(() => {
      setProgress(prev => {
        const next = prev + (INTERVAL / DURATION) * 100;
        return Math.min(next, 100);
      });
    }, INTERVAL);

    const timeoutId = window.setTimeout(() => {
      goToTutorialIndex(tutorialIndex + 1);
      // If we hit the end, move to success.
      if (tutorialIndex + 1 >= tutorialCards.length) {
        handleNext();
      }
    }, DURATION);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      stopTutorialTimer();
    };
  }, [step, tutorialIndex]);

  useEffect(() => {
    if (hasSession) {
      setStep(1);
    }
  }, [hasSession]);

  useEffect(() => {
    setDisplayName(initialProfile?.display_name?.toString() || '');
    setAgencyName(initialProfile?.agency_name?.toString() || '');
    setMonthlyGoal(initialProfile?.monthly_goal?.toString() || '');
  }, [initialProfile]);

  // If we just returned from Gmail OAuth, jump to Gmail step
  useEffect(() => {
    const checkPending = async () => {
      const url = new URL(window.location.href);
      const fromQuery = url.searchParams.get('gmail') === '1' || url.searchParams.get('onboarding') === 'gmail';
      const pending = localStorage.getItem(GMAIL_PENDING_KEY);
      if (!fromQuery && !pending) return;

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        setStep(2);
        localStorage.removeItem(GMAIL_PENDING_KEY);
        if (fromQuery) {
          url.searchParams.delete('gmail');
          url.searchParams.delete('onboarding');
          const cleaned = url.search ? `${url.pathname}?${url.searchParams.toString()}` : url.pathname;
          window.history.replaceState({}, document.title, cleaned);
        }
      }
    };
    void checkPending();
  }, [hasSession]);

  // Fetch Gmail status when on Gmail step
  useEffect(() => {
    const fetchGmailStatus = async () => {
      if (step !== 2) return;
      setGmailLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) { setGmailLoading(false); return; }
      const { data: profileRow } = await supabase.from('profiles').select('gmail_connected').eq('id', uid).maybeSingle();
      setGmailConnected(!!profileRow?.gmail_connected);
      const { data: accounts } = await supabase.from('gmail_accounts').select('email,avatar_url').eq('user_id', uid);
      if (accounts) setGmailAccounts(accounts.map(a => ({ email: a.email, avatar_url: a.avatar_url })));
      setGmailLoading(false);
    };
    void fetchGmailStatus();
  }, [step]);

  const handleNext = () => {
    if (step < 4) {
      setLoading(true);
      setTimeout(() => {
        setStep(step + 1);
        setLoading(false);
      }, 600);
    } else {
      onComplete();
    }
  };

  const handleTutorialNext = () => {
    if (tutorialIndex < tutorialCards.length - 1) {
      goToTutorialIndex(tutorialIndex + 1);
    } else {
      handleNext();
    }
  };

  const handleProfileSubmit = async () => {
    setProfileSaving(true);
    setProfileSaveError(null);
    const { error } = (await onProfileSave({
      display_name: displayName,
      agency_name: agencyName,
      monthly_goal: monthlyGoal ? Number(monthlyGoal) : undefined,
    })) || { error: null };
    if (error) {
      setProfileSaveError(error);
    } else {
      setStep(2);
    }
    setProfileSaving(false);
  };

  const handleGmailConnect = async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    localStorage.setItem(GMAIL_PENDING_KEY, 'true');
    startGmailOAuth(userId || undefined);
  };

  const renderStep = () => {
    switch (step) {
      case 0: // Auth
        return (
          <div className="flex flex-col flex-1 justify-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="w-14 h-14 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl ring-1 ring-slate-800/15 dark:ring-white/20">
                <img
                  src={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '/icon-dark.svg' : '/icon.svg'}
                  alt="GridLead logo"
                  className="w-7 h-7 object-contain"
                />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">
                {hasSession ? 'Continue setup' : mode === 'signup' ? 'Create your Workspace' : 'Welcome Back'}
              </h2>
              <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1.5">
                {hasSession ? 'Signed in. Finish onboarding below.' : mode === 'signup' ? 'Join 400+ solo creators today.' : 'Enter your credentials to continue.'}
              </p>
            </div>
            
            {hasSession ? (
            <div className="space-y-4">
              <button 
                onClick={() => setStep(1)}
                className="w-full h-12 bg-[#0f172a] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95"
              >
                Continue to profile
              </button>
            </div>
            ) : (
            <div className="space-y-4">
              <button 
                className="w-full h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-[11px] font-bold text-[#0f172a] hover:border-[#0f172a] transition-all active:scale-[0.98]"
                onClick={onGoogleAuth}
                type="button"
                disabled={!!submitting}
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
                {mode === 'signup' ? 'Sign up' : 'Log in'} with Google
              </button>
              <div className="flex items-center gap-4 py-1">
                <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
                <span className="text-[8px] font-bold text-slate-300 dark:text-slate-500 uppercase tracking-widest">Or email</span>
                <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="work@email.com" 
                    className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 text-xs font-bold text-[#0f172a] dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-200 dark:focus:ring-slate-700" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 text-xs font-bold text-[#0f172a] dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-200 dark:focus:ring-slate-700" 
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500 hover:text-[#0f172a] dark:hover:text-white">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              {authError && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-widest text-center">{authError}</p>}
              <button 
                onClick={() => onEmailAuth(mode, email, password)} 
                disabled={!email || !password || submitting}
                className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Working...' : mode === 'signup' ? 'Create Account' : 'Enter Workspace'} <ArrowRight size={14} />
              </button>
              <div className="text-center pt-2">
                <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="text-[9px] font-bold text-slate-400 dark:text-slate-500 hover:text-[#0f172a] dark:hover:text-white transition-colors uppercase tracking-widest underline underline-offset-4">
                  {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </div>
            )}
          </div>
        );
      case 1: // Profile
        return (
          <div className="flex flex-col flex-1 justify-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-white dark:bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center mx-auto shadow-md ring-1 ring-slate-100 dark:ring-white/20">
                <Mail size={24} />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">Set up your profile</h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium max-w-xs mx-auto">Tell us who you are and your targets. You can change this anytime.</p>
            </div>
            <div className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 sm:p-7 space-y-6 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]" />
              <div className="absolute -top-12 -right-10 w-28 h-28 bg-sky-500/10 blur-3xl" />
              <div className="absolute -bottom-16 -left-14 w-32 h-32 bg-emerald-400/10 blur-3xl" />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 relative z-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500 px-1">Display Name</label>
                  <input 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    type="text" 
                    placeholder="Alex Sterling" 
                    className="w-full h-12 sm:h-12 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold text-[#0f172a] dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500 px-1">Agency Name</label>
                  <input 
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    type="text" 
                    placeholder="GridLead Studio" 
                    className="w-full h-12 sm:h-12 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold text-[#0f172a] dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                  />
                </div>
              </div>

              <div className="relative z-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500 px-1">Monthly Goal ($)</label>
                  <input 
                    value={monthlyGoal}
                    onChange={(e) => setMonthlyGoal(e.target.value)}
                    type="number" 
                    placeholder="10000" 
                    className="w-full h-12 sm:h-12 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold text-[#0f172a] dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                  />
                </div>
              </div>

              {(profileError || profileSaveError) && (
                <p className="text-rose-500 text-[10px] font-bold uppercase tracking-widest text-center relative z-10">{profileError || profileSaveError}</p>
              )}

              <div className="pt-2 relative z-10">
                <button onClick={handleProfileSubmit} disabled={profileSaving} className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
                  {profileSaving ? 'Saving...' : 'Save & Continue'} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      case 2: // Gmail Connect
        return (
          <div className="flex flex-col flex-1 justify-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-white dark:bg-slate-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-md ring-1 ring-slate-100 dark:ring-white/20">
                <Send size={24} />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">Connect Gmail</h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium max-w-xs mx-auto">Use the same Google account you’ll send outreach from.</p>
            </div>
            <div className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 space-y-5 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]" />
              <div className="absolute -top-12 -right-10 w-28 h-28 bg-sky-500/10 blur-3xl" />
              <div className="absolute -bottom-16 -left-14 w-32 h-32 bg-emerald-400/10 blur-3xl" />

              <div className="relative z-10 space-y-4">
                <button 
                  onClick={handleGmailConnect}
                  className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
                >
                  <Mail size={14} /> {gmailConnected ? 'Connect another' : 'Connect Gmail'}
                </button>

                <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Connected Accounts</p>
                    {gmailLoading && <div className="w-4 h-4 border-2 border-slate-200 dark:border-slate-600 border-t-slate-500 dark:border-t-white rounded-full animate-spin" />}
                  </div>
                  {gmailLoading ? (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Checking...</p>
                  ) : gmailAccounts.length === 0 ? (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">None yet</p>
                  ) : (
                    <ul className="space-y-2">
                      {gmailAccounts.map((acct) => (
                        <li key={acct.email} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                          {acct.avatar_url ? (
                            <img src={acct.avatar_url} alt={acct.email} className="w-6 h-6 rounded-full border border-slate-100 dark:border-slate-700" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] flex items-center justify-center">
                              {acct.email.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{acct.email}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {gmailConnected && <p className="text-[10px] font-bold text-emerald-500 mt-3">Primary account connected.</p>}
                </div>

                <button 
                  onClick={() => setStep(3)}
                  className="w-full h-11 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg active:scale-95"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        );
      case 3: // Tutorial
        const card = tutorialCards[tutorialIndex];
        const remainingSeconds = Math.max(0, Math.ceil((DURATION * (1 - progress / 100)) / 1000));
        return (
          <div className="flex flex-col flex-1 justify-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 relative">
            <div className="relative rounded-[2rem] overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl p-6 space-y-4">
              <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]" />
              <div className="absolute -top-10 -right-12 w-32 h-32 bg-sky-500/10 blur-3xl" />
              <div className="absolute -bottom-14 -left-10 w-32 h-32 bg-emerald-400/10 blur-3xl" />

              <div className="flex items-center justify-between relative z-10">
                <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Module 0{tutorialIndex + 1}
                </div>
              </div>

              <div className="relative z-10 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-slate-900 dark:text-white shadow-sm border border-slate-100 dark:border-slate-800">
                    <card.icon size={22} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500 mb-1">{card.title}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">{card.desc}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-200">
                    <Search size={14} className="text-sky-500" /> Signals
                  </div>
                  <div className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-200">
                    <Gauge size={14} className="text-emerald-500" /> Scores
                  </div>
                  <div className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-200">
                    <MousePointer2 size={14} className="text-indigo-500" /> Actions
                  </div>
                  <div className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-200">
                    <Shield size={14} className="text-amber-500" /> Deliverability
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 relative z-10">
                <span>Auto-advance in {remainingSeconds}s</span>
                <div className="w-28 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-900 dark:bg-white transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            <div className="px-1">
              <div className="flex gap-4">
                 <button onClick={handleNext} className="flex-1 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
                  Skip Tour
                </button>
                <button onClick={handleTutorialNext} className="flex-[2] h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95">
                  {tutorialIndex === tutorialCards.length - 1 ? "Finish Setup" : "Next Module"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      case 4: // Success
        return (
          <div className="flex flex-col flex-1 justify-center space-y-8 animate-in fade-in zoom-in-95 duration-500 relative">
            <div className="relative rounded-[2rem] bg-white/90 shadow-[0_30px_90px_rgba(15,23,42,0.15)] dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-8 text-center">
              <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),transparent_45%)] dark:bg-[radial-gradient(circle_at_top,_rgba(2,132,199,0.25),transparent_45%)]" />
              <div className="relative z-10 space-y-4">
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                  <CheckCircle2 size={36} strokeWidth={2.5} />
                </div>
                <h2 className="text-3xl font-black text-[#0f172a] dark:text-white tracking-tight">Ready for Launch</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">
                  Your growth workspace is configured. Your Gmail sync and tour are complete.
                </p>
              </div>
            </div>

            <div className="px-4">
              <button
                onClick={handleNext}
                className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all hover:bg-slate-800 dark:hover:bg-slate-200 shadow-2xl flex items-center justify-center gap-2 active:scale-95"
              >
                Enter Platform <Zap size={18} />
              </button>
              <p className="mt-3 text-[10px] tracking-[0.3em] uppercase text-slate-400 dark:text-slate-500 text-center">
                Let the system keep scouting while you focus on closing.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 relative overflow-hidden">
      {/* Background Decor - Simplified to avoid 'outline growth' issue */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
      
      <div className="w-full max-w-[480px] bg-white/95 dark:bg-slate-900/85 border border-slate-100 dark:border-slate-800/80 rounded-[2.25rem] sm:rounded-[2.75rem] p-7 sm:p-9 shadow-[0_28px_80px_rgba(0,0,0,0.05)] relative z-10 min-h-[480px] sm:min-h-[520px] md:min-h-[560px] flex flex-col justify-between">
        {/* Top Header Dock - Fixed position logic */}
        <div className="flex justify-between items-center mb-6 h-12 shrink-0">
          <div className="flex-1">
            {step > 0 && step < 4 && (
              <button onClick={() => { setStep(step - 1); if (step === 3) setTutorialIndex(0); }} className="p-2 -ml-2 text-slate-300 hover:text-[#0f172a] dark:hover:text-white transition-all active:scale-90">
                <ArrowLeft size={20} />
              </button>
            )}
          </div>
          
          <div className="flex-1 flex justify-center">
            {step === 3 && (
              <div className="flex gap-2 items-center">
                {tutorialCards.map((_, i) => (
                  <span
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${tutorialIndex === i ? 'bg-[#0f172a] dark:bg-white scale-100' : tutorialIndex > i ? 'bg-slate-400 dark:bg-slate-600 opacity-80' : 'bg-slate-300 dark:bg-slate-700 opacity-60'} scale-100`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 flex justify-end">
            <button onClick={onCancel} className="p-2 -mr-2 text-slate-300 hover:text-[#0f172a] dark:hover:text-white transition-all active:scale-90">
              <X size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-[#0f172a] rounded-full animate-spin" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Loading Environment...</span>
          </div>
        ) : (
          renderStep()
        )}
      </div>
    </div>
  );
};

export default Onboarding;
