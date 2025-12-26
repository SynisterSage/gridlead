
import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Bell, 
  Shield, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ExternalLink,
  Smartphone,
  Zap,
  ChevronRight,
  Camera,
  FileText,
  Scale,
  ShieldAlert,
  Star,
  Check,
  Lock,
  Globe,
  Monitor,
  Smartphone as PhoneIcon,
  ToggleLeft as ToggleOff,
  ToggleRight as ToggleOn,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { getPlanLimits } from '../lib/planLimits';
import { Profile } from '../types';
import { supabase } from '../lib/supabaseClient';
import { startGmailOAuth } from '../services/gmailAuth';
import { subscribePush, saveSubscription, deleteSubscription } from '../lib/pushNotifications';
import { AppView } from '../types';
import UpgradeModal from './UpgradeModal';
import { openCustomerPortal } from '../services/billing';

type SettingsTab = 'profile' | 'integrations' | 'security' | 'notifications';

interface SettingsProps {
  onLogout?: () => void;
  profile?: Profile | null;
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
  agencyName?: string;
  authProvider?: string;
}

const Settings: React.FC<SettingsProps> = ({ onLogout, profile, userName, userEmail, userAvatarUrl, agencyName, authProvider }) => {
  const SETTINGS_TAB_KEY = 'gridlead_settings_tab';
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SETTINGS_TAB_KEY) as SettingsTab | null;
      if (saved) return saved;
    }
    return 'profile';
  });
  const [connectedEmails, setConnectedEmails] = useState<{ email: string; primary: boolean; id?: string; avatar_url?: string | null }[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const [bio, setBio] = useState(() => localStorage.getItem('gridlead_profile_bio') || '');
  const [bioSaved, setBioSaved] = useState(false);
  const [displayName, setDisplayName] = useState(userName || profile?.display_name || '');
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdMessage, setPwdMessage] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ lastSignIn?: string; expiresAt?: number } | null>(null);
  const [pushStatus, setPushStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');
  const [pushError, setPushError] = useState<string | null>(null);
  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const notifDefaults = { 
    leads: true, 
    replies: true, 
    weekly: false, 
    browser: false,
    send_failed: true,
    gmail_disconnected: true,
    goal_hit: true,
    lead_assigned: true,
    pipeline_threshold: false
  };
  const [notifPreferences, setNotifPreferences] = useState({ ...notifDefaults });
  const [portalLoading, setPortalLoading] = useState(false);
  const REOPEN_UPGRADE_KEY = 'gridlead_reopen_upgrade';
  const handleGmailConnect = async () => {
    // Remember to return to Settings/Integrations after OAuth flow
    localStorage.setItem('gridlead_return_view', 'settings');
    localStorage.setItem(SETTINGS_TAB_KEY, 'integrations');
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    startGmailOAuth(userId || undefined);
  };
  useEffect(() => {
    setDisplayName(userName || profile?.display_name || '');
  }, [userName, profile?.display_name]);

  const billingRowRef = React.useRef<HTMLDivElement | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // Persist upgrade modal open state so tab switches/browser refocus keep it visible
  useEffect(() => {
    const saved = sessionStorage.getItem('gl_upgrade_modal_open');
    if (saved === '1') {
      setShowUpgradeModal(true);
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem('gl_upgrade_modal_open', showUpgradeModal ? '1' : '0');
    if (!showUpgradeModal) {
      sessionStorage.removeItem('gl_upgrade_modal_state');
    }
  }, [showUpgradeModal]);

  const planLimits = getPlanLimits(profile?.plan);
  const leadLimit = planLimits.leadLimit;
  const leadsUsed = profile?.leads_used_this_month ?? 0;
  const leadsPct = leadLimit ? Math.min(100, Math.round((leadsUsed / (leadLimit || 1)) * 100)) : 0;
  const seatLimit = planLimits.senderLimit;
  const seatsUsed = profile?.sender_seats_used ?? 0;
  const seatsPct = seatLimit ? Math.min(100, Math.round((seatsUsed / (seatLimit || 1)) * 100)) : 0;
  let leadBarColor = 'bg-emerald-500';
  if (leadLimit) {
    if (leadsPct >= 100) leadBarColor = 'bg-rose-500';
    else if (leadsPct >= 80) leadBarColor = 'bg-amber-400';
  }

  const saveBio = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (uid) {
      await supabase.from('profiles').upsert({ id: uid, display_name: displayName });
    }
    localStorage.setItem('gridlead_profile_bio', bio);
    setBioSaved(true);
    setTimeout(() => setBioSaved(false), 1200);
  };

  const fetchGmailAccounts = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return;
    const { data: accounts } = await supabase
      .from('gmail_accounts')
      .select('id,email,is_primary,avatar_url')
      .eq('user_id', uid);
    if (accounts) {
      setConnectedEmails(
        accounts.map((a, idx) => ({
          email: a.email,
          primary: a.is_primary ?? idx === 0,
          id: a.id,
          avatar_url: a.avatar_url
        }))
      );
    }
  };

  const handleSendTestPush = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setNotification('No service worker registered. Register push-sw.js first.');
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setNotification('No push subscription found. Enable push in Notifications first.');
        return;
      }
      const payload = {
        title: 'GridLead — test notification',
        body: 'This is a test push. Click to open GridLead.',
        url: '/',
      };
      const endpoints: string[] = [];
      // Prefer the full Supabase functions URL when available (dev or prod)
      if (SUPABASE_URL) {
        const base = SUPABASE_URL.replace(/\/$/, '');
        endpoints.push(`${base}/functions/v1/send-push`);
      }
      // Also try relative paths (useful when deployed behind a proxy or using serverless api)
      endpoints.push('/functions/v1/send-push');
      endpoints.push('/api/send-push');
      let resp: Response | null = null;
      // Prepare headers: include Supabase anon/publishable key and Authorization if available
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const apikey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
      const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apikey) baseHeaders['apikey'] = apikey;
      if (token) baseHeaders['Authorization'] = `Bearer ${token}`;

      for (const ep of endpoints) {
        try {
          resp = await fetch(ep, {
            method: 'POST',
            headers: baseHeaders,
            body: JSON.stringify({ subscription: sub.toJSON(), payload }),
          });
          // If endpoint exists and is not a 404, break and use it.
          if (resp && resp.status !== 404) break;
        } catch (e) {
          resp = null;
        }
      }
      if (!resp) {
        setNotification('No push send endpoint available (tried /functions/v1/send-push and /api/send-push)');
        return;
      }
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        setNotification(json?.error || 'Push send failed');
        return;
      }
      setNotification('Test push sent — check your device.');
    } catch (err: any) {
      console.error('test push failed', err);
      setNotification(err?.message || 'Test push failed');
    }
  };

  useEffect(() => {
    fetchGmailAccounts();
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SETTINGS_TAB_KEY) as SettingsTab | null;
      if (saved) {
        setActiveTab(saved);
        localStorage.removeItem(SETTINGS_TAB_KEY);
      }
      const reopen = localStorage.getItem(REOPEN_UPGRADE_KEY);
      if (reopen) {
        setShowUpgradeModal(true);
        localStorage.removeItem(REOPEN_UPGRADE_KEY);
      }
      const params = new URLSearchParams(window.location.search);
      const billingStatus = params.get('billing');
      if (billingStatus === 'success') {
        setNotification('Checkout complete. Your plan will update shortly.');
      } else if (billingStatus === 'cancel') {
        setNotification('Checkout canceled — no changes were made.');
      } else if (billingStatus === 'portal') {
        setNotification('Returned from billing portal.');
      }
    }

    const fetchNotif = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      if (data) {
        setNotifPreferences({
          leads: data.leads ?? notifDefaults.leads,
          replies: data.replies ?? notifDefaults.replies,
          weekly: data.weekly ?? notifDefaults.weekly,
          browser: data.browser ?? notifDefaults.browser,
          send_failed: data.send_failed ?? notifDefaults.send_failed,
          gmail_disconnected: data.gmail_disconnected ?? notifDefaults.gmail_disconnected,
          goal_hit: data.goal_hit ?? notifDefaults.goal_hit,
          lead_assigned: data.lead_assigned ?? notifDefaults.lead_assigned,
          pipeline_threshold: data.pipeline_threshold ?? notifDefaults.pipeline_threshold
        });
      } else {
        await supabase.from('user_notifications').upsert({ user_id: uid, ...notifDefaults });
        setNotifPreferences(notifDefaults);
      }
    };

    const loadSessionMeta = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const lastSignIn = sessionData.session?.user?.last_sign_in_at;
      const expiresAt = sessionData.session?.expires_at;
      setSessionInfo({ lastSignIn: lastSignIn || undefined, expiresAt: expiresAt || undefined });
    };
    loadSessionMeta();
    fetchNotif();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleRemoveEmail = async (email: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return;
    const target = connectedEmails.find(c => c.email === email);
    if (!target?.id) return;
    await supabase.from('gmail_accounts').delete().eq('id', target.id).eq('user_id', uid);
    await fetchGmailAccounts();
  };

  const handleSetPrimary = async (email: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return;
    const target = connectedEmails.find(c => c.email === email);
    if (!target?.id) return;
    await supabase.from('gmail_accounts').update({ is_primary: false }).eq('user_id', uid);
    await supabase.from('gmail_accounts').update({ is_primary: true }).eq('id', target.id).eq('user_id', uid);
    await fetchGmailAccounts();
    setNotification('Primary account updated.');
  };

  const menuItems = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: User },
    { id: 'integrations' as SettingsTab, label: 'Integrations', icon: Zap },
    { id: 'security' as SettingsTab, label: 'Security', icon: Shield },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
  ];

  const handlePasswordChange = async () => {
    setPwdError(null);
    setPwdMessage(null);
    if (pwdNew !== pwdConfirm) {
      setPwdError('New passwords do not match.');
      return;
    }
    if (!pwdNew || pwdNew.length < 8) {
      setPwdError('Password must be at least 8 characters.');
      return;
    }
    setPwdSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwdNew });
      if (error) throw error;
      setPwdMessage('Password updated. You may need to re-login on other devices.');
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
    } catch (err: any) {
      setPwdError(err?.message || 'Unable to update password.');
    } finally {
      setPwdSaving(false);
    }
  };

  const handleGlobalSignOut = async () => {
    // Use robust logout flow to clear caches/service workers and redirect
    try {
      const { robustLogout } = await import('../lib/auth');
      await robustLogout({ redirectTo: '/' });
    } catch (e) {
      await supabase.auth.signOut({ scope: 'global' });
      window.location.replace('/');
    }
    if (onLogout) onLogout();
  };

  const handleLogoutClick = async () => {
    try {
      const { robustLogout } = await import('../lib/auth');
      await robustLogout({ redirectTo: '/' });
    } catch (e) {
      await supabase.auth.signOut();
      window.location.replace('/');
    }
    if (onLogout) onLogout();
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    const { url, error } = await openCustomerPortal();
    setPortalLoading(false);
    if (error || !url) {
      setNotification(error || 'Unable to open billing portal.');
      return;
    }
    window.location.href = url;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const formatExpiry = (ts?: number) => {
    if (!ts) return 'Unknown';
    const d = new Date(ts * 1000);
    return d.toLocaleString();
  };

  const handleToggleNotif = async (key: keyof typeof notifPreferences) => {
    const next = { ...notifPreferences, [key]: !notifPreferences[key] };
    setNotifPreferences(next);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (uid) {
      await supabase.from('user_notifications').upsert({ user_id: uid, ...next });
    }

    if (key === 'browser') {
      if (next.browser) {
        try {
          setPushError(null);
          setPushStatus('idle');
          if (!VAPID_PUBLIC_KEY) {
            throw new Error('VAPID key is undefined. Check VITE_VAPID_PUBLIC_KEY env.');
          }
          const sub = await subscribePush(VAPID_PUBLIC_KEY);
          await saveSubscription(sub);
          setPushStatus('granted');
        } catch (err) {
          console.error(err);
          const message = err instanceof Error ? err.message : 'Unable to enable push';
          setPushError(message);
          setPushStatus(message.toLowerCase().includes('denied') ? 'denied' : 'error');
          setNotifPreferences(prev => ({ ...prev, browser: false }));
          if (uid) {
            await supabase.from('user_notifications').upsert({ user_id: uid, ...next, browser: false });
          }
        }
      } else {
        try {
          await deleteSubscription();
          setPushStatus('idle');
          setPushError(null);
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 md:p-10 shadow-sm space-y-8">
              <div className="flex flex-col sm:flex-row items-center gap-6 md:gap-8 text-center sm:text-left">
                <div className="relative group shrink-0">
                  {userAvatarUrl ? (
                    <img src={userAvatarUrl} alt={userName || 'User'} className="w-20 h-20 md:w-24 md:h-24 rounded-[1.5rem] md:rounded-[2rem] object-cover border-2 border-slate-100 dark:border-slate-700 shadow-sm" />
                  ) : (
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center text-2xl font-black border-2 border-slate-900/10 dark:border-white/20 shadow-sm">
                      {(userName || userEmail || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg md:text-xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">{userName || 'Public Profile'}</h3>
                    <button
                      onClick={() => billingRowRef.current?.scrollIntoView({ behavior: 'smooth' })}
                      className="px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                    >
                      {getPlanLimits(profile?.plan).label}{profile?.plan_status ? ` • ${profile.plan_status}` : ''}
                    </button>
                  </div>
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {profile?.monthly_goal ? `Goal: $${profile.monthly_goal.toLocaleString()}` : 'Goal not set'}
                  </p>
                </div>
                  <div className="shrink-0 pt-4 sm:pt-0">
                  <button 
                    onClick={toggleTheme}
                    className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  >
                    {theme === 'light' ? <><Moon size={14} /> Dark Mode</> : <><Sun size={14} /> Light Mode</>}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                <div className="space-y-1.5">
                  <label className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Full Name</label>
                  <input 
                    type="text" 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-[#0f172a] dark:text-white focus:outline-none" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Email</label>
                  <input 
                    type="email" 
                    value={userEmail || ''} 
                    readOnly 
                    disabled 
                    className="w-full bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-80" 
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Bio</label>
                  <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Add a short bio (saved locally)"
                    className="w-full h-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs font-bold text-[#0f172a] dark:text-white focus:outline-none resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600" 
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={saveBio}
                  className="px-5 py-2.5 bg-[#0f172a] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm overflow-hidden"
                >
                  <span className="relative z-10 transition-opacity duration-200">
                    {bioSaved ? 'Changes Saved ✓' : 'Save Changes'}
                  </span>
                </button>
              </div>
            </div>
            {/* Billing Row */}
            <div ref={billingRowRef} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-extrabold text-[#0f172a] dark:text-white">Billing & Plan</h4>
                  <p className="text-[10px] md:text-[11px] text-slate-500 dark:text-slate-400">Usage and seats at a glance.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    {getPlanLimits(profile?.plan).label}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/40">
                    {profile?.plan_status ?? 'inactive'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    <span>Leads usage</span>
                    {leadLimit ? <span className="text-slate-400">{leadsPct}%</span> : <span className="text-slate-400">Unlimited</span>}
                  </div>
                  {leadLimit ? (
                    <>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 ${leadBarColor} transition-all`}
                          style={{ width: `${leadsPct}%` }}
                        />
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{(profile?.leads_used_this_month ?? 0)} / {getPlanLimits(profile?.plan).leadLimit} leads this month</div>
                    </>
                  ) : (
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Unlimited leads</div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    <span>Sender seats</span>
                    {seatLimit ? <span className="text-slate-400">{seatsPct}%</span> : <span className="text-slate-400">Unlimited</span>}
                  </div>
                  <div className="space-y-2">
                    {seatLimit ? (
                      <>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 ${seatLimit && seatsPct >= 100 ? 'bg-rose-500' : seatsPct >= 80 ? 'bg-amber-400' : 'bg-sky-500'} transition-all`}
                            style={{ width: `${seatsPct}%` }}
                          />
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{(profile?.sender_seats_used ?? 0)} / {seatLimit} seats used</div>
                      </>
                    ) : (
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Unlimited seats</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowUpgradeModal(true)} className="px-4 py-2 bg-[#0f172a] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm">
                      Upgrade
                    </button>
                    <button
                      onClick={handleOpenPortal}
                      disabled={portalLoading}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      {portalLoading ? 'Opening…' : 'Manage subscription'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'integrations':
        return (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 md:p-10 shadow-sm space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/20 rounded-xl flex items-center justify-center text-rose-500 border border-rose-100 dark:border-rose-900/50">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-[#0f172a] dark:text-white tracking-tight">Gmail Hub</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Connected Channels</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    {getPlanLimits(profile?.plan).senderLimit ? (
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{connectedEmails.length} / {getPlanLimits(profile?.plan).senderLimit} seats</div>
                    ) : (
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Unlimited seats</div>
                    )}
                    <div className="text-[9px] text-slate-400">Sender seats used</div>
                  </div>
                  <button onClick={handleGmailConnect} disabled={isConnecting} className="w-full sm:w-auto px-5 h-10 bg-[#0f172a] dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-slate-900/10">
                    {isConnecting ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={14} />} 
                    Connect Gmail
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {connectedEmails.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
                    No Gmail accounts connected yet.
                  </div>
                ) : (
                  connectedEmails.map(item => (
                    <div key={item.email} className={`flex items-center justify-between p-4 border rounded-2xl transition-all ${item.primary ? 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700' : 'bg-white dark:bg-transparent border-slate-50 dark:border-slate-800'}`}>
                      <div className="flex items-center gap-4 min-w-0">
                    {item.avatar_url ? (
                      <img src={item.avatar_url} alt={item.email} className="w-10 h-10 rounded-xl object-cover border border-slate-100 dark:border-slate-700" />
                    ) : (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-[11px] shrink-0 ${item.primary ? 'bg-[#0f172a] dark:bg-white text-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border border-slate-100/50 dark:border-slate-700'}`}>
                        {item.email.charAt(0).toUpperCase()}
                      </div>
                    )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <p className="text-[13px] font-bold text-[#0f172a] dark:text-white truncate tracking-tight">{item.email}</p>
                            {item.primary && (
                              <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-blue-100/50 dark:border-blue-900/50">Primary</span>
                            )}
                          </div>
                          <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest mt-0.5">Connected via OAuth 2.0</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 lg:opacity-100">
                        {!item.primary && (
                          <button 
                            onClick={() => handleSetPrimary(item.email)}
                            className="p-2 text-slate-300 dark:text-slate-600 hover:text-[#0f172a] dark:hover:text-white transition-all shrink-0 active:scale-90"
                            title="Set as Primary Master"
                          >
                            <Star size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleRemoveEmail(item.email)} 
                          className="p-2 text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors shrink-0"
                          title="Disconnect Account"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                <ShieldAlert size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                  The primary account is your main outreach identity. Rotating other connected accounts improves deliverability and protects your domain reputation.
                </p>
              </div>
            </section>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 md:p-10 shadow-sm space-y-10">
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-500 border border-indigo-100 dark:border-indigo-900/50">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-[#0f172a] dark:text-white tracking-tight">Account Protection</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Update Credentials</p>
                  </div>
                </div>
                
                {authProvider === 'google' ? (
                  <div className="flex items-start gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                    <Shield size={14} className="mt-0.5" />
                    <span>Signed in with Google. Password changes are managed in your Google Account.</span>
                  </div>
                ) : (
                  <div className="max-w-md space-y-3">
                    <input
                      type="password"
                      placeholder="Current password"
                      value={pwdCurrent}
                      onChange={(e) => setPwdCurrent(e.target.value)}
                      className="w-full h-11 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-[11px] font-semibold text-[#0f172a] dark:text-white bg-white dark:bg-slate-800 focus:outline-none"
                    />
                    <input
                      type="password"
                      placeholder="New password (min 8 chars)"
                      value={pwdNew}
                      onChange={(e) => setPwdNew(e.target.value)}
                      className="w-full h-11 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-[11px] font-semibold text-[#0f172a] dark:text-white bg-white dark:bg-slate-800 focus:outline-none"
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={pwdConfirm}
                      onChange={(e) => setPwdConfirm(e.target.value)}
                      className="w-full h-11 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-[11px] font-semibold text-[#0f172a] dark:text-white bg-white dark:bg-slate-800 focus:outline-none"
                    />
                    {(pwdError || pwdMessage) && (
                      <p className={`text-[11px] font-semibold ${pwdError ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {pwdError || pwdMessage}
                      </p>
                    )}
                    <button
                      onClick={handlePasswordChange}
                      disabled={pwdSaving}
                      className="w-full h-11 bg-[#0f172a] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60"
                    >
                      {pwdSaving ? 'Saving...' : 'Save Password'}
                    </button>
                  </div>
                )}
              </section>

              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-500 border border-blue-100 dark:border-blue-900/50">
                    <Monitor size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-[#0f172a] dark:text-white tracking-tight">Active Sessions</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Signed-in Devices</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700 shadow-sm">
                        <Monitor size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#0f172a] dark:text-white">This device</p>
                        <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">
                          Last sign-in: {formatDate(sessionInfo?.lastSignIn)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">
                          Session expires: {formatExpiry(sessionInfo?.expiresAt)}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleGlobalSignOut}
                      className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                    >
                      Sign out all
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 md:p-10 shadow-sm space-y-10">
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-500 border border-amber-100 dark:border-amber-900/50">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-[#0f172a] dark:text-white tracking-tight">Alert Preferences</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Workspace Notifications</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { key: 'leads', label: 'New Lead Discovered', desc: 'Alert me when automated discovery finds 90%+ matches.' },
                    { key: 'replies', label: 'Outreach Replies', desc: 'Immediate notification when a prospect replies to a thread.' },
                    { key: 'send_failed', label: 'Send Failed', desc: 'Notify me when an outreach send fails so I can retry.' },
                    { key: 'gmail_disconnected', label: 'Gmail Disconnected', desc: 'Alert me when my primary Gmail disconnects or loses auth.' },
                    { key: 'goal_hit', label: 'Goal Achieved', desc: 'Celebrate when revenue or outreach goals are hit.' },
                    { key: 'lead_assigned', label: 'Lead Assigned', desc: 'Notify me when a lead is assigned to me.' },
                    { key: 'pipeline_threshold', label: 'Pipeline Threshold', desc: 'Alert when pipeline value drops below or exceeds a threshold.' },
                    { key: 'weekly', label: 'Weekly Summary', desc: 'A performance recap delivered every Monday morning. (Requires verified email sender—set up in Settings → Email.)' },
                    { key: 'browser', label: 'Browser Push Notifications', desc: 'System-level alerts for critical workspace activity.' }
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-5 border border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-slate-50/30 dark:hover:bg-slate-800/50 transition-all">
                      <div className="max-w-[80%] space-y-1">
                        <p className="text-[11px] font-bold text-[#0f172a] dark:text-white mb-0.5">{item.label}</p>
                        <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 leading-relaxed">{item.desc}</p>
                        {item.key === 'browser' && pushError && (
                          <p className="text-[9px] font-bold text-rose-500">
                            Push setup failed: {pushError}. Allow notifications in browser settings and ensure VAPID key is set.
                          </p>
                        )}
                      </div>
                      <button 
                        onClick={() => handleToggleNotif(item.key as keyof typeof notifPreferences)}
                        className={`transition-all ${notifPreferences[item.key as keyof typeof notifPreferences] ? 'text-[#0f172a] dark:text-white' : 'text-slate-200 dark:text-slate-800'}`}
                      >
                        {notifPreferences[item.key as keyof typeof notifPreferences] ? <ToggleOn size={32} strokeWidth={1.5} /> : <ToggleOff size={32} strokeWidth={1.5} />}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-12 md:pt-20 pb-32 animate-in fade-in duration-700">
      {/* Global Toast for settings actions */}
      {notification && (
        <div className="fixed top-8 right-8 z-[100] animate-in slide-in-from-right-10 duration-500">
          <div className="bg-[#0f172a] dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 dark:border-slate-100">
            <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check size={14} strokeWidth={3} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">{notification}</span>
          </div>
        </div>
      )}

      <div className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] dark:text-white mb-2 tracking-tight">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg font-medium">Manage your workspace and outreach identities.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
        
        {/* Mobile Tab Nav */}
        <div className="lg:col-span-1 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 lg:flex-none flex items-center justify-center lg:justify-between p-3 md:p-4 rounded-xl md:rounded-2xl transition-all font-bold text-[9px] md:text-xs uppercase tracking-widest whitespace-nowrap shrink-0 ${
                activeTab === item.id 
                ? 'bg-[#0f172a] dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-900/10 dark:shadow-white/5' 
                : 'bg-white dark:bg-slate-900 lg:bg-transparent text-slate-400 hover:text-[#0f172a] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 border lg:border-none border-slate-100 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <item.icon size={16} />
                <span className="hidden sm:inline">{item.label}</span>
              </div>
              <ChevronRight size={14} className={`hidden lg:block ${activeTab === item.id ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-2">
          {renderContent()}

              {showUpgradeModal && (
                <UpgradeModal
                  visible={showUpgradeModal}
                  onClose={() => setShowUpgradeModal(false)}
                  currentPlan={profile?.plan ?? null}
                  onConfirm={(planId) => {
                    setNotification(`Redirecting to secure checkout for ${planId}...`);
                    setShowUpgradeModal(false);
                  }}
                />
              )}

          <div className="mt-8 md:mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 px-4">
            <p className="text-[9px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-widest">Workspace ID: GL-992-PX</p>
            <button 
              onClick={handleLogoutClick}
              className="text-[9px] md:text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-all uppercase tracking-widest flex items-center gap-2"
            >
              Log out of Session <ExternalLink size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
