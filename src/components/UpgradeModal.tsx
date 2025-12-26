import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, Info, Mail, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { startSubscription } from '../services/billing';
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

const PlanCard: React.FC<{ plan: Plan; selected?: boolean; hovered?: boolean; active?: boolean; onAction: () => void }> = ({ plan, selected, hovered, active, onAction }) => {
  const isActive = !!active;
  // Outline non-selected, non-active cards — include featured (Studio) so it
  // displays the same outlined treatment as Agency when not selected.
  const isOutlined = !selected && !isActive;
  const showSelected = !!selected;
  const showHover = !!hovered;
  // Keep a consistent 1px border to avoid layout shift when hovering (don't
  // toggle border width). We toggle only the border color and shadow.
  const borderColorClass = isOutlined ? 'border-slate-700' : showHover ? 'border-slate-500/40' : 'border-transparent';
  return (
    <div className={`relative group p-6 md:p-8 rounded-[1.5rem] flex-1 h-full flex flex-col transition-all duration-300 overflow-visible border ${borderColorClass} ${showSelected ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xl' : 'bg-white dark:bg-transparent text-slate-700 dark:text-slate-300'} ${showHover ? 'shadow-xl translate-y-[-2px]' : ''} ${isActive && !showSelected ? 'border-emerald-300 ring-2 ring-emerald-400/40 dark:ring-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-900/10' : ''}` }>
      {/* subtle hover gradient */}
      <div className="absolute inset-0 rounded-[1.5rem] pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-b from-emerald-400/6 to-transparent mix-blend-overlay" />
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
        <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-500"><CheckCircle2 size={16} className="text-emerald-400" /> {b}</li>
      ))}
    </ul>
      <div className="mt-4">
      <button
        onClick={onAction}
        disabled={isActive && !showSelected}
        aria-current={isActive && !showSelected ? true : undefined}
        className={`w-full py-3 rounded-xl font-bold transition-colors duration-150 ${showSelected ? 'bg-emerald-500 text-white' : isActive && !showSelected ? 'bg-transparent text-emerald-700 border border-emerald-200 cursor-default' : 'bg-transparent text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}
      >
        {plan.id === 'agency' ? (isActive && !showSelected ? 'Waitlisted' : 'Join waitlist') : isActive && !showSelected ? 'Active' : `Choose ${plan.title}`}
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
    <div className="space-y-3">
      <PaymentElement />
      <button
        onClick={handlePay}
        disabled={paying || !stripe}
        className="w-full mt-2 px-5 py-2.5 rounded-xl bg-[#0f172a] text-white font-bold text-sm shadow-sm hover:bg-slate-800 transition-all disabled:opacity-60"
      >
        {paying ? 'Processing…' : `Pay and upgrade to ${planTitle}`}
      </button>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        Payments are processed securely by Stripe. We never see or store your card details.
      </p>
    </div>
  );
};

const UpgradeModal: React.FC<UpgradeModalProps> = ({ visible, onClose, onConfirm, currentPlan }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<'select' | 'confirm' | 'waitlist' | 'success'>('select');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // mounted: whether to render the modal at all
  const [mounted, setMounted] = useState<boolean>(false);
  // openState: controls the translate/opacity for enter/exit animation
  const [openState, setOpenState] = useState<boolean>(false);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  // active plan from props (the user's actual plan)
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [activePlanStatus, setActivePlanStatus] = useState<string | null>(null);
  // waitlist form state (mock)
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistCompany, setWaitlistCompany] = useState('');
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);

  useEffect(() => {
    let pollId: number | null = null;
    let unmountTimer: number | null = null;

    const fetchProfileOnce = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id;
        if (uid) {
          const { data: profileRow, error } = await supabase
            .from('profiles')
            .select('plan,plan_status')
            .eq('id', uid)
            .maybeSingle();
          if (!error && profileRow) {
            const mapped = mapPlanToId(profileRow.plan);
            setActivePlan(mapped);
            setActivePlanStatus(profileRow.plan_status ?? null);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    const onFocus = () => {
      // re-fetch when window/tab regains focus while modal is open
      void fetchProfileOnce();
    };

    if (visible) {
      setMounted(true);
      setStage('select');
      setSelected(null);
      void fetchProfileOnce();
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

  if (!mounted) return null;

  // the plan (used in confirm flow)
  const plan = PLANS.find(p => p.id === selected) || PLANS[1];

  const startClose = (delay = 300) => {
    // animate out locally then call onClose after the animation
    setOpenState(false);
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
    setConfirmError(null);
    if (!clientSecret) {
      setConfirmLoading(true);
      void (async () => {
        const { clientSecret: cs, error } = await startSubscription(plan.id as 'studio');
        setConfirmLoading(false);
        if (error || !cs) {
          setConfirmError(error || 'Unable to start subscription.');
          return;
        }
        setClientSecret(cs);
      })();
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
          <div>
            <h3 className="text-xl font-extrabold">Upgrade plan</h3>
            <p className="text-sm text-slate-500">Pick a plan and proceed to checkout (mock).</p>
          </div>
          <button onClick={() => startClose()} className="text-slate-500 hover:text-slate-900 p-2 rounded-md">
            <X />
          </button>
        </div>

        <div className="mt-4 rounded-lg">
          <div className="p-4 md:p-6 overflow-auto max-h-[calc(100vh-160px)] pb-24"> 
            {stage === 'select' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                {PLANS.map(p => (
                  <div key={p.id} className="relative h-full" onMouseEnter={() => setHoveredPlan(p.id)} onMouseLeave={() => setHoveredPlan(null)}>
                    <PlanCard
                      plan={p}
                      selected={p.id === selected}
                      hovered={p.id === hoveredPlan}
                      active={p.id === activePlan}
                      onAction={() => {
                        if (p.id === 'agency') {
                          // open in-modal waitlist mock flow
                          setSelected(p.id);
                          setStage('waitlist');
                          return;
                        }
                        // choose a plan within the modal and move to confirm stage
                        setSelected(p.id);
                        setStage('confirm');
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            {stage === 'confirm' && (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest">
                      <span>Preview</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">Confirm {plan.title}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                        No payment will be processed in this preview. When ready, replace this button with your Stripe Checkout session call.
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
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Ready for Stripe: replace the CTA below with a call to your checkout/session endpoint.
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {!clientSecret && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => setStage('select')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                        Back
                      </button>
                      <button
                        onClick={handleConfirm}
                        disabled={confirmLoading}
                        className="px-5 py-2.5 rounded-xl bg-[#0f172a] text-white font-bold text-sm shadow-sm hover:bg-slate-800 transition-all disabled:opacity-60"
                      >
                        {confirmLoading ? 'Preparing payment…' : 'Enter payment'}
                      </button>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">Secure in-app checkout.</span>
                      {confirmError && <span className="text-[11px] text-rose-500">{confirmError}</span>}
                    </div>
                  )}

                  {clientSecret && stripePromise ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <PaymentStep
                        clientSecret={clientSecret}
                        planTitle={plan.title}
                        onSuccess={() => {
                          setStage('success');
                          onConfirm?.(plan.id);
                        }}
                        onError={(msg) => setConfirmError(msg)}
                      />
                      {confirmError && <p className="text-[11px] text-rose-500 mt-2">{confirmError}</p>}
                    </Elements>
                  ) : clientSecret && !stripePromise ? (
                    <p className="text-[11px] text-rose-500">
                      Missing Stripe publishable key. Set VITE_STRIPE_PUBLISHABLE_KEY in env and redeploy.
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {stage === 'waitlist' && (
              <div className="space-y-6 max-w-3xl">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    <Info size={12} />
                    <span>Mock waitlist</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">Join the Agency+ waitlist</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Agency+ is in development. Add your details to preview the flow and we’ll notify you when invites open.
                      This is a mock submission—no data is sent to a server.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Work email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        value={waitlistEmail}
                        onChange={(e) => setWaitlistEmail(e.target.value)}
                        placeholder="you@agency.com"
                        type="email"
                        aria-label="Work email"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
                      />
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
                    <select
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
                      defaultValue="scale"
                    >
                      <option value="scale">Scale outreach with AI playbooks</option>
                      <option value="deliverability">Better deliverability guardrails</option>
                      <option value="reporting">Deeper reporting & analytics</option>
                      <option value="other">Other (tell us later)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button onClick={() => setStage('select')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                    Back
                  </button>
                  <button
                    disabled={!waitlistEmail || waitlistSubmitting}
                    onClick={async () => {
                      setWaitlistSubmitting(true);
                      // mock submit delay
                      setTimeout(() => {
                        setWaitlistSubmitting(false);
                        setStage('success');
                        onConfirm?.(plan.id);
                      }, 700);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-60"
                  >
                    {waitlistSubmitting ? 'Submitting…' : 'Join waitlist'}
                  </button>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">Mock only — no data is stored.</span>
                </div>
              </div>
            )}

            {stage === 'success' && (
              <div className="mt-6 text-center">
                <div className="w-20 h-20 rounded-full mx-auto bg-emerald-500 flex items-center justify-center text-white mb-4">
                  <CheckCircle2 size={28} />
                </div>
                {selected === 'agency' ? (
                  <>
                    <h4 className="text-lg font-extrabold">You're on the waitlist</h4>
                    <p className="text-sm text-slate-500">Thanks — we'll notify you when Agency+ opens. This is a mock success state.</p>
                  </>
                ) : (
                  <>
                    <h4 className="text-lg font-extrabold">Mock purchase complete</h4>
                    <p className="text-sm text-slate-500">The UI now reflects a successful mock upgrade. When you connect Stripe we'll replace this flow with a real checkout redirect.</p>
                  </>
                )}
                <div className="mt-6">
                  <button onClick={() => startClose(220)} className="px-6 py-3 rounded-xl bg-white border">Done</button>
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
