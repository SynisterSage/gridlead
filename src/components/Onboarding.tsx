
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
  X
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
      title: "Discover Local Leads",
      desc: "Mine local business databases to find merchants who need your help. We score them based on web presence and public ratings.",
      icon: Search,
      color: "text-blue-500",
      img: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=600&h=450"
    },
    {
      title: "AI-Driven Review",
      desc: "Deep-dive into every lead. Use AI to analyze performance, accessibility, and design before you ever reach out.",
      icon: ListFilter,
      color: "text-indigo-500",
      img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600&h=450"
    },
    {
      title: "Automated Outreach",
      desc: "Send high-converting, personalized emails at scale. Track responses and manage your winning deals in one pipeline.",
      icon: Send,
      color: "text-amber-500",
      img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600&h=450"
    }
  ];

  useEffect(() => {
    if (step === 3) {
      setProgress(0);
      const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
          setProgress(prev => {
            const next = prev + (INTERVAL / DURATION) * 100;
            if (next >= 100) {
              setTutorialIndex(current => {
                if (current >= tutorialCards.length - 1) {
                  if (timerRef.current) clearInterval(timerRef.current);
                  return current;
                }
                return current + 1;
              });
              return 0; 
            }
            return next;
          });
        }, INTERVAL);
      };
      startTimer();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
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
      if (!hasSession) return;
      const url = new URL(window.location.href);
      const fromQuery = url.searchParams.get('gmail') === '1' || url.searchParams.get('onboarding') === 'gmail';
      const pending = localStorage.getItem(GMAIL_PENDING_KEY);
      if (fromQuery || pending) {
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
      setTutorialIndex(tutorialIndex + 1);
      setProgress(0);
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
              <div className="w-14 h-14 bg-[#0f172a] rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl">
                <Zap size={24} fill="currentColor" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
                {hasSession ? 'Continue setup' : mode === 'signup' ? 'Create your Workspace' : 'Welcome Back'}
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">
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
                <div className="h-px bg-slate-100 flex-1" />
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Or email</span>
                <div className="h-px bg-slate-100 flex-1" />
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="work@email.com" 
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-1 focus:ring-slate-200" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-1 focus:ring-slate-200" 
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[#0f172a]">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              {authError && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-widest text-center">{authError}</p>}
              <button 
                onClick={() => onEmailAuth(mode, email, password)} 
                disabled={!email || !password || submitting}
                className="w-full h-12 bg-[#0f172a] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Working...' : mode === 'signup' ? 'Create Account' : 'Enter Workspace'} <ArrowRight size={14} />
              </button>
              <div className="text-center pt-2">
                <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="text-[9px] font-bold text-slate-400 hover:text-[#0f172a] transition-colors uppercase tracking-widest underline underline-offset-4">
                  {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </div>
            )}
          </div>
        );
      case 1: // Profile
        return (
          <div className="flex flex-col flex-1 justify-center space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-6 border border-blue-100">
                <Mail size={32} />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Set up your profile</h2>
              <p className="text-slate-500 text-xs font-medium mt-2 max-w-xs mx-auto">Tell us who you are and your targets. You can change this anytime.</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-100/90">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 px-1">Display Name</label>
                  <input 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    type="text" 
                    placeholder="Alex Sterling" 
                    className="w-full h-12 sm:h-14 bg-[#edf3ff] border border-slate-100 rounded-2xl px-5 text-sm font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all placeholder:text-slate-400" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 px-1">Agency Name</label>
                  <input 
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    type="text" 
                    placeholder="GridLead Studio" 
                    className="w-full h-12 sm:h-14 bg-[#edf3ff] border border-slate-100 rounded-2xl px-5 text-sm font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all placeholder:text-slate-400" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 px-1">Monthly Goal ($)</label>
                  <input 
                    value={monthlyGoal}
                    onChange={(e) => setMonthlyGoal(e.target.value)}
                    type="number" 
                    placeholder="10000" 
                    className="w-full h-12 sm:h-14 bg-[#edf3ff] border border-slate-100 rounded-2xl px-5 text-sm font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all placeholder:text-slate-400" 
                  />
                </div>
              </div>
            </div>
            {(profileError || profileSaveError) && (
              <p className="text-rose-500 text-[10px] font-bold uppercase tracking-widest text-center">{profileError || profileSaveError}</p>
            )}
            <button 
              onClick={handleProfileSubmit} 
              disabled={profileSaving}
              className="w-full h-14 bg-[#0f172a] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {profileSaving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        );
      case 2: // Gmail Connect
        return (
          <div className="flex flex-col flex-1 justify-center space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mx-auto mb-6 border border-emerald-100">
                <Send size={32} />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Connect Gmail</h2>
              <p className="text-slate-500 text-xs font-medium mt-2 max-w-xs mx-auto">Use the same Google account you’ll send outreach from.</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-4 shadow-sm ring-1 ring-slate-100/80">
              <button 
                onClick={handleGmailConnect}
                className="w-full h-12 bg-[#0f172a] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <Mail size={14} /> {gmailConnected ? 'Connect another' : 'Connect Gmail'}
              </button>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">Connected Accounts</p>
                {gmailLoading ? (
                  <p className="text-[10px] text-slate-400">Checking...</p>
                ) : gmailAccounts.length === 0 ? (
                  <p className="text-[10px] text-slate-400">None yet</p>
                ) : (
                  <ul className="space-y-2">
                    {gmailAccounts.map((acct) => (
                      <li key={acct.email} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 truncate">
                        {acct.avatar_url ? (
                          <img src={acct.avatar_url} alt={acct.email} className="w-6 h-6 rounded-full border border-slate-100" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center">
                            {acct.email.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{acct.email}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {gmailConnected && <p className="text-[10px] font-bold text-emerald-500 mt-2">Primary account connected.</p>}
              </div>
              <button 
                onClick={() => setStep(3)}
                className="w-full h-11 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                Continue
              </button>
            </div>
          </div>
        );
      case 3: // Tutorial
        const card = tutorialCards[tutorialIndex];
        return (
          <div className="flex flex-col flex-1 justify-center space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 relative">
            {/* Background Decorative Circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] border border-slate-50 rounded-full -z-10 pointer-events-none opacity-50" />
            
            <div className="relative rounded-[2rem] overflow-hidden bg-slate-100 aspect-[4/3] shadow-2xl border border-slate-100">
               <img src={card.img} alt={card.title} className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-[#0f172a]/10" />
               <div className="absolute bottom-6 left-6 right-6">
                  <div className="bg-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-4 w-fit animate-in zoom-in duration-500">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#0f172a] shadow-sm border border-slate-100">
                      <card.icon size={20} />
                    </div>
                    <span className="text-[#0f172a] font-extrabold text-base tracking-tight">{card.title}</span>
                  </div>
               </div>
            </div>

            <div className="px-2">
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">{card.desc}</p>
              <div className="flex gap-4">
                 <button onClick={handleNext} className="flex-1 h-14 bg-white border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-95">
                  Skip Tour
                </button>
                <button onClick={handleTutorialNext} className="flex-[2] h-14 bg-[#0f172a] text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#1e293b] transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95">
                  {tutorialIndex === tutorialCards.length - 1 ? "Finish Setup" : "Next Module"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      case 4: // Success
        return (
          <div className="flex flex-col flex-1 justify-center space-y-10 animate-in fade-in zoom-in-95 duration-500 text-center py-6">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mx-auto border border-emerald-100">
              <CheckCircle2 size={36} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-[#0f172a] tracking-tight">Ready for Launch</h2>
              <p className="text-slate-500 text-sm font-medium mt-2">Your growth workspace is configured and ready.</p>
            </div>
            <div className="pt-2">
              <button onClick={handleNext} className="w-full h-16 bg-[#0f172a] text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-[#1e293b] transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95">
                Enter Platform <Zap size={18} fill="currentColor" />
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor - Simplified to avoid 'outline growth' issue */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:24px_24px]" />
      
      <div className="w-full max-w-[440px] bg-white border border-slate-100 rounded-[3.5rem] p-10 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.05)] relative z-10 min-h-[660px] flex flex-col">
        {/* Top Header Dock - Fixed position logic */}
        <div className="flex justify-between items-center mb-6 h-12 shrink-0">
          <div className="flex-1">
            {step > 0 && step < 4 && (
              <button onClick={() => { setStep(step - 1); if (step === 3) setTutorialIndex(0); }} className="p-2 -ml-2 text-slate-300 hover:text-[#0f172a] transition-all active:scale-90">
                <ArrowLeft size={20} />
              </button>
            )}
            {step === 3 && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-1">Module 0{tutorialIndex + 1}</span>
            )}
          </div>
          
          <div className="flex-1 flex justify-center">
            {step === 3 && (
              <div className="flex gap-1.5 items-center">
                {tutorialCards.map((_, i) => (
                  <div key={i} className="w-8 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#0f172a] transition-all duration-300" 
                      style={{ width: tutorialIndex === i ? `${progress}%` : (tutorialIndex > i ? '100%' : '0%') }} 
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 flex justify-end">
            <button onClick={onCancel} className="p-2 -mr-2 text-slate-300 hover:text-[#0f172a] transition-all active:scale-90">
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
