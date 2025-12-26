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

const PlanCard: React.FC<{ plan: Plan; selected: boolean; onSelect: () => void }> = ({ plan, selected, onSelect }) => {
  const isOutlined = !selected && !plan.featured;
  return (
    <div className={`relative group p-6 md:p-8 rounded-[1.5rem] flex-1 flex flex-col transition-transform duration-300 ${plan.featured || selected ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xl' : 'bg-transparent dark:bg-transparent text-slate-300'} ${isOutlined ? 'border border-slate-700' : ''} ${selected ? 'ring-2 ring-emerald-400' : ''}`}>
      {plan.badge && (
        <div className="absolute -top-3 right-5 flex items-center gap-2">
          <div className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${plan.featured ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-800'}`}>{plan.badge}</div>
          {plan.badge.toLowerCase().includes('development') && (
            <div className="relative">
              <div className="group">
                <button aria-label="In development info" className="w-6 h-6 rounded-full bg-slate-800/60 dark:bg-slate-700 flex items-center justify-center text-[12px] text-slate-300 hover:bg-slate-800 transition-colors">?</button>
                <div className="absolute right-0 bottom-full mb-3 w-48 p-3 bg-slate-900 text-white rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50 ring-1 ring-white/10">
                  <div className="text-[10px] font-black uppercase tracking-widest mb-2">In development</div>
                  <p className="text-[11px] text-slate-200">This plan or feature is still in development and may be unavailable. Use the mock flow to preview behavior.</p>
                </div>
              </div>
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
        <li key={i} className="flex items-center gap-3 text-sm text-slate-500"><CheckCircle2 size={16} className="text-emerald-400" /> {b}</li>
      ))}
    </ul>
    <div className="mt-4">
      <button onClick={onSelect} className={`w-full py-3 rounded-xl font-bold ${plan.featured || selected ? 'bg-emerald-500 text-white' : 'bg-transparent text-white border border-slate-700'}`}>
        {selected ? 'Selected' : plan.featured ? 'Selected' : `Choose ${plan.title}`}
      </button>
      {plan.id === 'agency' && (
        <div className="mt-3 text-center">
          <a href="/waitlist" className="text-sm text-slate-400 underline">Join waitlist</a>
        </div>
      )}
    </div>
  </div>
  );
};

const UpgradeModal: React.FC<UpgradeModalProps> = ({ visible, onClose, onConfirm }) => {
  const [selected, setSelected] = useState<string>('studio');
  const [stage, setStage] = useState<'select' | 'confirm' | 'success'>('select');

  // mounted: whether to render the modal at all
  const [mounted, setMounted] = useState<boolean>(false);
  // openState: controls the translate/opacity for enter/exit animation
  const [openState, setOpenState] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      // mount then trigger enter transition on next frame
      setMounted(true);
      setStage('select');
      setSelected('studio');
      requestAnimationFrame(() => requestAnimationFrame(() => setOpenState(true)));
    } else {
      // trigger exit animation then unmount
      setOpenState(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [visible]);

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

        <div className="mt-4 max-h-[75vh] rounded-lg">
          <div className="p-4 md:p-6 overflow-auto max-h-[72vh]">
            {stage === 'select' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map(p => (
                  <div key={p.id} className="relative">
                    <PlanCard plan={p} selected={p.id === selected} onSelect={() => {
                      if (p.id === 'agency') {
                        // agency goes to waitlist as requested
                        window.location.href = '/waitlist';
                        return;
                      }
                      setSelected(p.id);
                    }} />
                  </div>
                ))}
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

        {stage === 'select' && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-500">Selected: <span className="font-bold">{plan.title}</span></div>
            <div className="flex items-center gap-3">
              <button onClick={() => setStage('confirm')} className="px-4 py-2 rounded-xl bg-[#0f172a] text-white font-bold">Proceed to Checkout (mock)</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default UpgradeModal;
