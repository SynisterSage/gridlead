import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, Info } from 'lucide-react';

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

const PlanCard: React.FC<{ plan: Plan; selected?: boolean; hovered?: boolean; active?: boolean; onAction: () => void; onShowTooltip?: (id: string | null) => void }> = ({ plan, selected, hovered, active, onAction, onShowTooltip }) => {
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
    <div className={`relative group p-6 md:p-8 rounded-[1.5rem] flex-1 h-full flex flex-col transition-colors duration-300 overflow-hidden border ${borderColorClass} ${showSelected ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xl' : 'bg-white dark:bg-transparent text-slate-700 dark:text-slate-300'} ${showHover ? 'shadow-xl' : ''} ${isActive && !showSelected ? 'border-emerald-300 ring-2 ring-emerald-400/40 dark:ring-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-900/10' : ''}` }>
      {/* decorative blurs like LandingPage — placed inside and clipped by overflow-hidden */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/10 blur-3xl opacity-0 pointer-events-none transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute -bottom-12 -left-6 w-28 h-28 bg-emerald-400/10 blur-3xl opacity-0 pointer-events-none transition-opacity duration-300 group-hover:opacity-100" />
      {/* subtle hover gradient */}
      <div className="absolute inset-0 rounded-[1.5rem] pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-b from-emerald-400/6 to-transparent mix-blend-overlay" />
      {plan.badge && (
        <div className="absolute top-3 right-5 flex items-center gap-2 z-10">
          <div className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${plan.featured ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-800'}`}>{plan.badge}</div>
          {plan.badge.toLowerCase().includes('development') && (
            <div>
              <button aria-label="In development info" onMouseEnter={() => onShowTooltip?.(plan.id)} onMouseLeave={() => onShowTooltip?.(null)} className="w-6 h-6 rounded-full bg-slate-800/60 dark:bg-slate-700 flex items-center justify-center text-[12px] text-slate-300 hover:bg-slate-800 transition-colors">?</button>
            </div>
          )}
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
        {plan.id === 'agency' ? 'Join waitlist' : isActive && !showSelected ? 'Active' : `Choose ${plan.title}`}
      </button>
    </div>
  </div>
  );
};

const UpgradeModal: React.FC<UpgradeModalProps> = ({ visible, onClose, onConfirm, currentPlan }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<'select' | 'confirm' | 'success'>('select');

  // mounted: whether to render the modal at all
  const [mounted, setMounted] = useState<boolean>(false);
  // openState: controls the translate/opacity for enter/exit animation
  const [openState, setOpenState] = useState<boolean>(false);
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const hideTooltipTimer = React.useRef<number | null>(null);

  // active plan from props (the user's actual plan)
  const [activePlan, setActivePlan] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      // mount then trigger enter transition on next frame
      setMounted(true);
      setStage('select');
      // set active selected plan on open from prop
      setSelected(null);
      requestAnimationFrame(() => requestAnimationFrame(() => setOpenState(true)));
    } else {
      // trigger exit animation then unmount
      setOpenState(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (hideTooltipTimer.current) {
        window.clearTimeout(hideTooltipTimer.current);
        hideTooltipTimer.current = null;
      }
    };
  }, []);

  // sync active plan from props on mount/update
  useEffect(() => {
    setActivePlan(currentPlan ?? null);
  }, [currentPlan]);

  if (!mounted) return null;

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
    // mock confirm then close
    setStage('success');
    onConfirm?.(plan.id);
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
                          // agency goes to waitlist (external)
                          window.location.href = '/waitlist';
                          return;
                        }
                        // choose a plan within the modal and move to confirm stage
                        setSelected(p.id);
                        setStage('confirm');
                      }}
                      onShowTooltip={(id) => {
                        if (hideTooltipTimer.current) {
                          window.clearTimeout(hideTooltipTimer.current);
                          hideTooltipTimer.current = null;
                        }
                        if (id) {
                          setHoveredTooltip(id);
                        } else {
                          hideTooltipTimer.current = window.setTimeout(() => setHoveredTooltip(null), 220);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Render tooltip outside scrollable grid to avoid clipping */}
            {hoveredTooltip === 'agency' && (
              <div
                onMouseEnter={() => {
                  if (hideTooltipTimer.current) {
                    window.clearTimeout(hideTooltipTimer.current);
                    hideTooltipTimer.current = null;
                  }
                }}
                onMouseLeave={() => {
                  if (hideTooltipTimer.current) window.clearTimeout(hideTooltipTimer.current);
                  hideTooltipTimer.current = window.setTimeout(() => setHoveredTooltip(null), 220);
                }}
                className="absolute right-6 top-16 w-56 p-3 bg-slate-900 text-white rounded-lg shadow-2xl z-50 ring-1 ring-white/10">
                <div className="text-[10px] font-black uppercase tracking-widest mb-2">In development</div>
                <p className="text-[12px] text-slate-200">This plan or feature is still in development and may be unavailable. Use the mock flow to preview behavior.</p>
              </div>
            )}

            {stage === 'confirm' && (
              <div>
                <h4 className="text-lg font-extrabold mb-2">Confirm {plan.title}</h4>
                <p className="text-sm text-slate-500 mb-6">This is a mock confirmation. No real payment will be processed. When you're ready to enable real payments we'll swap the CTA to call your backend to create a Stripe Checkout session.</p>
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm text-slate-700 mb-2"><span>Plan</span><span className="font-bold">{plan.title}</span></div>
                  <div className="flex items-center justify-between text-sm text-slate-700"><span>Price</span><span className="font-bold">{plan.price}{plan.per}</span></div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStage('select')} className="px-4 py-2 rounded-xl border">Back</button>
                  <button onClick={handleConfirm} className="px-4 py-2 rounded-xl bg-[#0f172a] text-white font-bold">Confirm (mock)</button>
                </div>
              </div>
            )}

            {stage === 'success' && (
              <div className="mt-6 text-center">
                <div className="w-20 h-20 rounded-full mx-auto bg-emerald-500 flex items-center justify-center text-white mb-4">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="text-lg font-extrabold">Mock purchase complete</h4>
                <p className="text-sm text-slate-500">The UI now reflects a successful mock upgrade. When you connect Stripe we'll replace this flow with a real checkout redirect.</p>
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
