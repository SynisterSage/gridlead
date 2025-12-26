import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, Info, Mail, Briefcase, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { startSubscription, openCustomerPortal } from '../services/billing';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface Plan {
  id: string;
  title: string;
  price: string;
  per: string;
  tagline: string;
  bullets: string[];
  badge?: string;
  featured?: boolean;
}

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm?: (planId: string) => void;
  // current active plan id from server (e.g. 'starter' | 'studio' | 'agency')
  currentPlan?: string | null;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    title: 'Starter',
    price: '$0',
    per: '/mo',
    tagline: 'Kick the tires with real leads.',
    bullets: ['50 leads / mo', '2 sender seats', 'Light audits (perf + SSL)', 'Email templates + replies', 'Community support'],
  },
  {
    id: 'studio',
    title: 'Studio',
    price: '$25',
    per: '/mo',
    tagline: 'Built for web shops growing pipeline.',
    bullets: ['1,000 leads / mo', '5 sender seats + rotation', 'Deep audits (perf, UX, SEO)', 'Auto-personalized outreach', 'Deliverability safeguards', 'Priority support'],
    badge: 'Best Value',
    featured: true,
  },
  {
    id: 'agency',
    title: 'Agency+',
    price: '$49.99',
    per: '/mo',
    tagline: 'Unlimited scale with advanced AI automation.',
    bullets: ['Unlimited leads', 'Unlimited sender seats + pools', 'AI playbooks & auto-sequencing', 'Gemini Site Check', 'Dynamic landing tear-downs', 'Deliverability guardrails + domain pools'],
    badge: 'In development',
  }
];

// Normalize various DB plan values to canonical plan IDs used by the UI
const mapPlanToId = (raw?: any): string | null => {
  if (!raw && raw !== 0) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  // common variants that should map to agency
  if (s.includes('agency') || s.includes('agency+') || s.includes('agency_waitlist') || s.includes('agency_plus') || s.includes('enterprise')) return 'agency';
  if (s.includes('studio') || s.includes('pro')) return 'studio';
  if (s.includes('starter') || s.includes('free') || s.includes('basic')) return 'starter';
  // fallback if already a canonical id
  if (['starter', 'studio', 'agency'].includes(s)) return s;
  return null;
};

const PlanCard: React.FC<{ plan: Plan; selected?: boolean; hovered?: boolean; active?: boolean; activeStatus?: string | null; highlight?: boolean; onAction: () => void; isDowngradeTarget?: boolean; agencyApproved?: boolean; waitlistPending?: boolean; waitlistApproved?: boolean; }> = ({ plan, selected, hovered, active, activeStatus, highlight, onAction, isDowngradeTarget, agencyApproved, waitlistPending, waitlistApproved }) => {
  const isActive = !!active;
  const isPending = activeStatus === 'pending';
  // Outline non-selected, non-active cards — include featured (Studio) so it
  // displays the same outlined treatment as Agency when not selected.
  const isOutlined = !selected && !isActive;
  const showSelected = !!selected;
  const showHover = !!hovered;
  // Keep a consistent 1px border to avoid layout shift when hovering (don't
  // toggle border width). We toggle only the border color and shadow.
  const borderColorClass = isOutlined ? 'border-slate-700' : showHover ? 'border-slate-500/40' : 'border-transparent';
  return (
    <div className={`relative group p-6 md:p-8 rounded-[1.5rem] flex-1 h-full flex flex-col transition-all duration-300 overflow-visible border ${borderColorClass} ${showSelected ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xl' : 'bg-white dark:bg-transparent text-slate-700 dark:text-slate-300'} ${showHover ? 'shadow-xl translate-y-[-2px]' : ''} ${isActive && !showSelected ? 'border-emerald-300 ring-2 ring-emerald-400/40 dark:ring-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-900/10' : ''} ${highlight ? 'shadow-[0_14px_50px_-14px_rgba(16,185,129,0.55)] ring-[3px] ring-emerald-300/60' : ''}` }>
      {/* subtle hover gradient */}
      <div className="absolute inset-0 rounded-[1.5rem] pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-b from-emerald-400/6 to-transparent mix-blend-overlay" />
      {highlight && <span className="absolute inset-0 rounded-[1.5rem] bg-emerald-200/10 blur-lg animate-pulse pointer-events-none" />}
      {plan.badge && (
        <div className="absolute top-3 right-5 z-10">
          {plan.id === 'studio' ? (
            <div className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${plan.featured ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-800'}`}>{plan.badge}</div>
          ) : plan.id === 'agency' ? (
            <div className="relative group/icon">
              <div
                className="w-7 h-7 rounded-full bg-slate-800/60 dark:bg-slate-700 flex items-center justify-center text-[12px] text-slate-300 hover:bg-slate-800 transition-colors cursor-help outline-none"
              >
                ?
              </div>
              <div className="absolute top-full right-0 mt-2 max-w-[240px] p-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl shadow-2xl opacity-0 invisible group-hover/icon:opacity-100 group-hover/icon:visible transition-all duration-200 text-[10px] font-medium leading-relaxed z-20 whitespace-normal ring-1 ring-white/10">
                <div className="flex items-center gap-2 mb-2 text-emerald-300">
                  <Info size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">{plan.badge}</span>
                </div>
                <p className="text-[10px] font-medium leading-relaxed opacity-80">
                  Agency+ is in development. Join the waitlist or stick with Studio while we finish this plan.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    <div className="mb-4">
      <h4 className="text-lg font-extrabold">{plan.title}</h4>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl md:text-4xl font-extrabold leading-none">{plan.price}</div>
        <div className="text-sm text-slate-500">{plan.per}</div>
      </div>
      <p className="text-sm text-slate-400 mt-2">{plan.tagline}</p>
    </div>
    <ul className="flex-1 space-y-3 mb-4">
      {plan.bullets.map((b, i) => (
        <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-500">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  <div className="mt-4">
  <button
    onClick={onAction}
    disabled={isActive && !showSelected && isPending && !agencyApproved}
    aria-current={isActive && !showSelected ? true : undefined}
        className={`w-full py-3 rounded-xl font-bold transition-colors duration-150 ${showSelected ? 'bg-emerald-500 text-white' : isPending && waitlistPending ? 'bg-transparent text-white border border-sky-500 cursor-default' : isActive && !showSelected ? 'bg-transparent text-emerald-400 border border-emerald-300 cursor-default' : 'bg-transparent text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}
      >
    {plan.id === 'agency'
      ? (waitlistPending
          ? 'Request received'
          : (agencyApproved || waitlistApproved)
          ? (isActive && !showSelected ? 'Active' : 'Upgrade to Agency+')
          : 'Join waitlist')
      : isActive && !showSelected
      ? 'Active'
      : isDowngradeTarget
      ? (
        <span className="flex items-center justify-center gap-1">
              Switch to Starter
              <span className="relative group/tt inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800/60 text-slate-300 text-[10px] font-black">
                ?
                <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-52 p-2 text-[10px] font-medium bg-slate-900 text-white rounded-lg shadow-2xl opacity-0 group-hover/tt:opacity-100 pointer-events-none transition-opacity duration-200 ring-1 ring-white/10">
                  Downgrade via Manage Subscription. It takes effect at the end of your billing period.
                </span>
              </span>
            </span>
          )
          : `Choose ${plan.title}`}
      </button>
    </div>
  </div>
  );
};

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const PaymentStep: React.FC<{
  clientSecret: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  planTitle: string;
}> = ({ clientSecret, onSuccess, onError, planTitle }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);

  if (!stripe || !elements) {
    return (
      <div className="space-y-3">
        <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Loading secure payment form…</p>
      </div>
    );
  }

  const handlePay = async () => {
    setPaying(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: window.location.origin,
      },
    });
    setPaying(false);
    if (error) {
      onError(error.message || 'Payment failed');
      return;
    }
    if (paymentIntent && ['succeeded', 'processing', 'requires_action'].includes(paymentIntent.status)) {
      onSuccess();
    } else {
      onError('Payment did not complete.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-3 md:p-4">
        <PaymentElement />
      </div>
      <button
        onClick={handlePay}
        disabled={paying || !stripe}
        className="w-full px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-all disabled:opacity-60"
      >
        {paying ? 'Processing…' : `Pay and upgrade to ${planTitle}`}
      </button>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
        Payments are processed securely by Stripe. We never see or store your card details.
      </p>
    </div>
  );
};

const UPGRADE_STATE_KEY = 'gl_upgrade_modal_state';

const UpgradeModal: React.FC<UpgradeModalProps> = ({ visible, onClose, onConfirm, currentPlan }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<'select' | 'confirm' | 'waitlist' | 'success'>('select');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<'success' | 'error'>('error');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const hydratedRef = React.useRef(false);

  // mounted: whether to render the modal at all
  const [mounted, setMounted] = useState<boolean>(false);
  // openState: controls the translate/opacity for enter/exit animation
  const [openState, setOpenState] = useState<boolean>(false);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [justActivated, setJustActivated] = useState<string | null>(null);

  // active plan from props (the user's actual plan)
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [activePlanStatus, setActivePlanStatus] = useState<string | null>(null);
  const [agencyApproved, setAgencyApproved] = useState<boolean>(false);
  const [agencyWaitlistStatus, setAgencyWaitlistStatus] = useState<string | null>(null);
  // waitlist form state
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistCompany, setWaitlistCompany] = useState('');
  const [waitlistUseCase, setWaitlistUseCase] = useState('scale');
  const [waitlistUseCaseMode, setWaitlistUseCaseMode] = useState<'preset' | 'custom'>('preset');
  const [waitlistUseCaseCustom, setWaitlistUseCaseCustom] = useState('');
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistAvatar, setWaitlistAvatar] = useState<string | null>(null);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [toastHiding, setToastHiding] = useState(false);

  const refreshProfile = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (uid) {
        const { data: profileRow, error } = await supabase
          .from('profiles')
          .select('plan,plan_status,agency_approved,agency_name,display_name,agency_waitlist_status')
          .eq('id', uid)
          .maybeSingle();
        if (!error && profileRow) {
          const mapped = mapPlanToId(profileRow.plan);
          setActivePlan(mapped);
          setActivePlanStatus(profileRow.plan_status ?? null);
          setAgencyApproved(!!profileRow.agency_approved);
          setAgencyWaitlistStatus(profileRow.agency_waitlist_status ?? null);
          const email = sessionData.session?.user?.email;
          if (email && !waitlistEmail) setWaitlistEmail(email);
          if (profileRow.agency_name && !waitlistCompany) setWaitlistCompany(profileRow.agency_name);
          if (profileRow.display_name && !waitlistName) setWaitlistName(profileRow.display_name);
          const avatar = sessionData.session?.user?.user_metadata?.avatar_url || null;
          if (avatar) setWaitlistAvatar(avatar);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    let unmountTimer: number | null = null;

    const onFocus = () => {
      // re-fetch when window/tab regains focus while modal is open
      void refreshProfile();
    };

    if (visible) {
      setMounted(true);
      if (!hydratedRef.current) {
        try {
          const raw = sessionStorage.getItem(UPGRADE_STATE_KEY) || localStorage.getItem(UPGRADE_STATE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.selected) setSelected(parsed.selected);
            if (parsed.stage) setStage(parsed.stage);
            if (parsed.clientSecret) setClientSecret(parsed.clientSecret);
          } else {
            setStage('select');
            setSelected(null);
          }
        } catch (e) {
          setStage('select');
          setSelected(null);
        } finally {
          hydratedRef.current = true;
        }
      } else if (!sessionStorage.getItem(UPGRADE_STATE_KEY) && !localStorage.getItem(UPGRADE_STATE_KEY)) {
        setStage('select');
        setSelected(null);
      }
      void refreshProfile();
      window.addEventListener('focus', onFocus);
      requestAnimationFrame(() => requestAnimationFrame(() => setOpenState(true)));
    } else {
      setOpenState(false);
      unmountTimer = window.setTimeout(() => setMounted(false), 320);
    }

    return () => {
      if (unmountTimer) {
        window.clearTimeout(unmountTimer);
      }
      window.removeEventListener('focus', onFocus);
    };
  }, [visible]);

  // sync active plan from props on mount/update but prefer DB fetches when available
  useEffect(() => {
    if (currentPlan && activePlan === null) {
      setActivePlan(mapPlanToId(currentPlan));
    }
  }, [currentPlan]);

  useEffect(() => {
    if (visible) {
      try {
        const payload = JSON.stringify({ selected, stage, clientSecret });
        sessionStorage.setItem(
          UPGRADE_STATE_KEY,
          JSON.stringify({ selected, stage, clientSecret }),
        );
        localStorage.setItem(UPGRADE_STATE_KEY, payload);
      } catch (e) {
        // ignore storage failures
      }
    }
  }, [visible, selected, stage, clientSecret]);

  // the plan (used in confirm flow)
  const plan = PLANS.find(p => p.id === selected) || PLANS[1];

  // Prefill waitlist email when entering waitlist stage
  useEffect(() => {
    if (stage !== 'waitlist' || waitlistEmail) return;
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email;
      if (email) setWaitlistEmail(email);
    })();
  }, [stage, waitlistEmail]);

  // Auto-start subscription when landing on confirm stage without a client secret
  useEffect(() => {
    if (stage === 'confirm' && !clientSecret && (plan.id === 'studio' || plan.id === 'agency') && visible) {
      setConfirmLoading(true);
      setConfirmError(null);
      setInlineError(null);
      setToastMsg(null);
      void (async () => {
        const { clientSecret: cs, error } = await startSubscription(plan.id as 'studio' | 'agency');
        setConfirmLoading(false);
        if (error || !cs) {
          setConfirmError(error || 'Unable to start subscription.');
          setToastMsg(error || 'Unable to start subscription.');
          return;
        }
        setClientSecret(cs);
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, plan.id, visible]);

  // Reset selection/errors when returning to selection stage
  useEffect(() => {
    if (stage === 'select') {
      setSelected(null);
      setClientSecret(null);
      setConfirmError(null);
      setInlineError(null);
      setHoveredPlan(null);
    }
  }, [stage]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      setToastHiding(false);
      const t = setTimeout(() => {
        setToastHiding(true);
        setTimeout(() => {
          setToastMsg(null);
          setToastHiding(false);
        }, 260);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);

  useEffect(() => {
    if (justActivated) {
      const t = setTimeout(() => setJustActivated(null), 1200);
      return () => clearTimeout(t);
    }
  }, [justActivated]);

  if (!mounted) return null;

  const startClose = (delay = 300) => {
    // animate out locally then call onClose after the animation
    setOpenState(false);
    sessionStorage.removeItem(UPGRADE_STATE_KEY);
    localStorage.removeItem(UPGRADE_STATE_KEY);
    setTimeout(() => {
      setMounted(false);
      onClose();
    }, delay);
  };

  const handleConfirm = () => {
    if (plan.id === 'agency') {
      setStage('waitlist');
      return;
    }
    // No longer triggered; kept for safety if reused elsewhere
    if (stage !== 'confirm') {
      setStage('confirm');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${openState ? 'opacity-100' : 'opacity-0'}`} onClick={() => startClose()} />
      <aside
        className={`ml-auto w-full max-w-[940px] bg-white dark:bg-slate-900 p-4 md:p-6 shadow-2xl transform transition-transform duration-300 ${openState ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
      >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {stage !== 'select' && (
                <button
                  onClick={() => {
                    setStage('select');
                    setClientSecret(null);
                    setConfirmError(null);
                    setInlineError(null);
                    setSelected(null);
                  }}
                  className="p-2 rounded-md text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label="Back"
                >
                  <ChevronLeft size={20} className="transition-transform duration-150 group-hover:-translate-x-0.5" />
                </button>
              )}
            <div>
              <h3 className="text-xl font-extrabold">Upgrade plan</h3>
              <p className="text-sm text-slate-500">Pick a plan and proceed to checkout.</p>
            </div>
          </div>
          <button
            onClick={() => startClose()}
            className="p-2 rounded-md text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {toastMsg && (
          <div className={`fixed right-6 top-6 z-[200] transition-all duration-300 ${toastHiding ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'} will-change-transform`}>
            <div className={`${toastKind === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold`}>
              {toastMsg}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-lg">
      <div className="p-4 md:p-6 overflow-y-auto overflow-x-visible max-h-[calc(100vh-140px)] pb-48 pt-1"> 
        {stage === 'select' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                {agencyWaitlistStatus === 'pending' && (
                  <div className="md:col-span-3 p-4 rounded-xl bg-sky-900/20 border border-sky-700 text-sky-100 text-sm font-semibold flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    Request received — your Agency+ access is in review. We’ll notify you once approved.
                  </div>
                )}
                {agencyWaitlistStatus === 'approved' && (
                  <div className="md:col-span-3 p-4 rounded-xl bg-emerald-900/20 border border-emerald-700 text-emerald-100 text-sm font-semibold flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Approved — upgrade to Agency+ when you’re ready.
                  </div>
                )}
                {PLANS.map(p => {
                  const isDowngradeTarget = activePlan === 'studio' && p.id === 'starter';
                  return (
                    <div key={p.id} className="relative h-full" onMouseEnter={() => setHoveredPlan(p.id)} onMouseLeave={() => setHoveredPlan(null)}>
                      <PlanCard
                        plan={p}
                        selected={p.id === selected}
                        hovered={p.id === hoveredPlan}
                        active={p.id === activePlan}
                        activeStatus={agencyWaitlistStatus === 'pending' ? 'pending' : activePlanStatus}
                        agencyApproved={agencyApproved}
                        waitlistPending={agencyWaitlistStatus === 'pending'}
                        waitlistApproved={agencyWaitlistStatus === 'approved'}
                        isDowngradeTarget={isDowngradeTarget}
                        highlight={justActivated === p.id}
                        onAction={() => {
                          if (isDowngradeTarget) {
                            void (async () => {
                              // Persist return state so we land back in Settings with the modal open
                              localStorage.setItem('gridlead_return_view', 'settings');
                              localStorage.setItem('gridlead_return_tab', 'profile');
                              localStorage.setItem('gridlead_return_upgrade_open', '1');
                              sessionStorage.setItem('gl_upgrade_modal_open', '1');
                              localStorage.removeItem('gl_cancel_disclosure_seen'); // show disclosure after cancel
                              const { url, error } = await openCustomerPortal();
                              if (error || !url) {
                                setToastKind('error');
                                setToastMsg(error || 'Unable to open billing portal.');
                                return;
                              }
                              window.location.href = url;
                            })();
                            return;
                          }
                          if (p.id === 'agency') {
                            if (agencyApproved || agencyWaitlistStatus === 'approved') {
                              setSelected(p.id);
                              setStage('confirm');
                              return;
                            }
                            setSelected(p.id);
                            setStage('waitlist');
                            return;
                          }
                          setSelected(p.id);
                          setStage('confirm');
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {stage === 'confirm' && (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                      <span>Checkout</span>
                      <div className="relative group">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-help">?</span>
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-3 bg-slate-900 text-white rounded-xl text-[11px] leading-relaxed shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 border border-slate-800">
                          Payments are processed by Stripe. Card details never touch our servers.
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">Confirm {plan.title}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                        Secure, in-app payment. We’ll start your subscription as soon as your payment method is confirmed.
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{plan.title}</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">{plan.price}<span className="text-sm font-semibold text-slate-500">{plan.per}</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <div className="col-span-1 md:col-span-2 p-4 md:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">What you get</span>
                      {plan.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {plan.bullets.slice(0, 6).map((b, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                    <div className="p-4 md:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3 shadow-sm">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Plan summary</span>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Plan</span>
                        <span className="font-bold text-slate-900 dark:text-white">{plan.title}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Price</span>
                        <span className="font-bold text-slate-900 dark:text-white">{plan.price}{plan.per}</span>
                      </div>
                      <div className="rounded-xl bg-slate-100 dark:bg-slate-800/70 px-3 py-3 text-[11px] text-slate-600 dark:text-slate-200 leading-relaxed border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                        <span className="mt-0.5 text-slate-500 dark:text-slate-300">ℹ️</span>
                        <span>Card will be charged by Stripe each month. Manage or cancel anytime from Settings → Billing.</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                  {clientSecret && stripePromise ? (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          rules: {
                            '.Error': { display: 'none' },
                            '.Input--invalid': { boxShadow: 'none', borderColor: '#e2e8f0' },
                          },
                        },
                      }}
                    >
                      <PaymentStep
                        clientSecret={clientSecret}
                        planTitle={plan.title}
                        onSuccess={() => {
                          setToastKind('success');
                          setToastMsg(`Upgraded to ${plan.title}.`);
                          setStage('select');
                          setSelected(null);
                          setClientSecret(null);
                          setActivePlan(plan.id);
                          setActivePlanStatus('active');
                          setJustActivated(plan.id);
                          void refreshProfile();
                          onConfirm?.(plan.id);
                        }}
                        onError={(msg) => {
                          setToastKind('error');
                          setToastMsg(msg);
                        }}
                      />
                    </Elements>
                  ) : clientSecret && !stripePromise ? (
                    <p className="text-[11px] text-rose-500">
                      Missing Stripe publishable key. Set VITE_STRIPE_PUBLISHABLE_KEY in env and redeploy.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <button onClick={() => setStage('select')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                          Back
                        </button>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                          <div className="h-3 w-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Fetching payment form…</span>
                        </div>
                      </div>
                      <div className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 animate-pulse" />
                      <div className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 animate-pulse" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {stage === 'waitlist' && (
              <div className="space-y-6 max-w-3xl">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    <Info size={12} />
                    <span>Waitlist</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">Join the Agency+ waitlist</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Agency+ is in development. Add your details and we’ll notify you when invites open. We’ll review your request and keep you on Studio until approval.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Account email</label>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60">
                      {waitlistAvatar ? (
                        <img src={waitlistAvatar} alt={waitlistName || waitlistEmail} className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-white text-sm font-bold">
                          {(waitlistName || waitlistEmail || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-slate-900 dark:text-white">{waitlistName || 'Workspace member'}</span>
                        <span className="text-[12px] text-slate-500 dark:text-slate-300 flex items-center gap-2">
                          <Mail size={14} className="text-slate-400 dark:text-slate-500" />
                          {waitlistEmail || 'you@agency.com'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Company (optional)</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        value={waitlistCompany}
                        onChange={(e) => setWaitlistCompany(e.target.value)}
                        placeholder="Your company"
                        aria-label="Company (optional)"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
                      />
                    </div>
                    </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">What do you want most?</label>
                    {waitlistUseCaseMode === 'preset' ? (
                      <select
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
                        style={{ backgroundPosition: 'calc(100% - 12px) center' }}
                        value={waitlistUseCase}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'other') {
                            setWaitlistUseCaseMode('custom');
                            setWaitlistUseCaseCustom('');
                          } else {
                            setWaitlistUseCase(val);
                          }
                        }}
                      >
                        <option value="scale">Scale outreach with AI playbooks</option>
                        <option value="deliverability">Better deliverability guardrails</option>
                        <option value="reporting">Deeper reporting & analytics</option>
                        <option value="other">Other (type it)</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setWaitlistUseCaseMode('preset')}
                          className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          aria-label="Back to presets"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <input
                          value={waitlistUseCaseCustom}
                          onChange={(e) => setWaitlistUseCaseCustom(e.target.value)}
                          placeholder="Tell us what you need most"
                          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    disabled={!waitlistEmail || waitlistSubmitting || agencyWaitlistStatus === 'pending'}
                    onClick={async () => {
                      setInlineError(null);
                      setWaitlistSubmitting(true);
                      try {
                        const { data: sessionData } = await supabase.auth.getSession();
                        const uid = sessionData.session?.user?.id;
                        const email = waitlistEmail || sessionData.session?.user?.email || '';
                        if (!uid || !email) {
                          throw new Error('Missing user session. Please re-login.');
                        }
                        const useCaseValue = waitlistUseCaseMode === 'custom' && waitlistUseCaseCustom
                          ? waitlistUseCaseCustom
                          : waitlistUseCase;

                        const { error: waitlistErr } = await supabase
                          .from('agency_waitlist')
                          .upsert({
                            user_id: uid,
                            email,
                            company: waitlistCompany || null,
                            use_case: useCaseValue,
                            status: 'pending',
                          }, { onConflict: 'user_id' });
                        if (waitlistErr) throw waitlistErr;

                        const { error: profErr } = await supabase
                          .from('profiles')
                          .update({
                            agency_waitlist_status: 'pending',
                            agency_waitlist_requested_at: new Date().toISOString(),
                            cancel_at_period_end: false,
                          })
                          .eq('id', uid);
                        if (profErr) throw profErr;

                        setAgencyWaitlistStatus('pending');
                        setToastKind('success');
                        setToastMsg('Request received. We’ll notify you when Agency+ is approved.');
                        setStage('select');
                        setSelected(null);
                        onConfirm?.('agency_pending');
                      } catch (err: any) {
                        setInlineError(err?.message || 'Unable to submit waitlist request.');
                        setToastKind('error');
                        setToastMsg('Unable to submit waitlist request.');
                      } finally {
                        setWaitlistSubmitting(false);
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-60"
                  >
                    {waitlistSubmitting ? 'Submitting…' : 'Join waitlist'}
                  </button>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">We’ll keep you on Studio until approval.</span>
                  {inlineError && (
                    <span className="text-[11px] text-rose-500 font-semibold">{inlineError}</span>
                  )}
                </div>
              </div>
            )}

            {stage === 'success' && (
              <div className="mt-6 text-center">
                <div className="w-20 h-20 rounded-full mx-auto bg-emerald-500 flex items-center justify-center text-white mb-4 animate-in zoom-in">
                  <CheckCircle2 size={28} />
                </div>
                {selected === 'agency' || agencyWaitlistStatus === 'pending' ? (
                  <>
                    <h4 className="text-lg font-extrabold">Request received</h4>
                    <p className="text-sm text-slate-500">We’ll review your request and notify you when Agency+ is approved.</p>
                  </>
                ) : (
                  <>
                    <h4 className="text-lg font-extrabold">Upgrade complete</h4>
                    <p className="text-sm text-slate-500">Your plan is now updated. You can manage billing anytime from Settings.</p>
                  </>
                )}
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setStage('select');
                      setSelected(null);
                    }}
                    className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold shadow-sm"
                  >
                    Stay here
                  </button>
                  <button onClick={() => startClose(220)} className="px-6 py-3 rounded-xl bg-[#0f172a] text-white font-semibold shadow-sm">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* removed bottom text and proceed button — choose buttons now navigate to mock pages */}
      </aside>
    </div>
  );
};

export default UpgradeModal;
