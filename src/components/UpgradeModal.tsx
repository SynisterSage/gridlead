import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

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

const PlanCard: React.FC<{ plan: Plan; selected: boolean; onSelect: () => void }> = ({ plan, selected, onSelect }) => (
  <div className={`p-6 rounded-2xl flex-1 flex flex-col transition-shadow duration-200 ${plan.featured ? 'bg-slate-900 text-white shadow-2xl' : 'bg-white dark:bg-slate-900 shadow-sm'} ${selected ? 'ring-2 ring-emerald-400' : ''}`}>
    {plan.badge && (
      <div className={`absolute top-4 right-4 px-2 py-0.5 text-[10px] font-bold rounded ${plan.featured ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-800'}`}>{plan.badge}</div>
    )}
    <div className="mb-4">
      <h4 className="text-lg font-extrabold">{plan.title}</h4>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-extrabold">{plan.price}</div>
        <div className="text-sm text-slate-500">{plan.per}</div>
      </div>
      <p className="text-xs text-slate-400 mt-2">{plan.tagline}</p>
    </div>
    <ul className="flex-1 space-y-2 mb-4">
      {plan.bullets.map((b, i) => (
        <li key={i} className="flex items-center gap-2 text-sm text-slate-500"><CheckCircle2 size={16} className="text-emerald-400" /> {b}</li>
      ))}
    </ul>
    <div className="mt-4">
      <button onClick={onSelect} className={`w-full py-3 rounded-xl font-bold ${plan.featured ? 'bg-white text-slate-900' : 'bg-[#0f172a] text-white'}`}>
        {selected ? 'Selected' : plan.featured ? 'Choose Studio' : `Choose ${plan.title}`}
      </button>
    </div>
  </div>
);

const UpgradeModal: React.FC<UpgradeModalProps> = ({ visible, onClose, onConfirm }) => {
  const [selected, setSelected] = useState<string>('studio');
  const [stage, setStage] = useState<'select' | 'confirm' | 'success'>('select');

  if (!visible) return null;

  const plan = PLANS.find(p => p.id === selected) || PLANS[1];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="ml-auto w-full max-w-xl bg-white dark:bg-slate-900 p-6 md:p-10 shadow-2xl transform transition-transform duration-300 animate-in slide-in-from-right-3" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-extrabold">Upgrade plan</h3>
            <p className="text-sm text-slate-500">Pick a plan and proceed to checkout (mock).</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">Close</button>
        </div>

        {stage === 'select' && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map(p => (
              <PlanCard key={p.id} plan={p} selected={p.id === selected} onSelect={() => setSelected(p.id)} />
            ))}
          </div>
        )}

        {stage === 'confirm' && (
          <div className="mt-6">
            <h4 className="text-lg font-extrabold mb-2">Confirm {plan.title}</h4>
            <p className="text-sm text-slate-500 mb-6">This is a mock confirmation. No real payment will be processed. When you're ready to enable real payments we'll swap the CTA to call your backend to create a Stripe Checkout session.</p>
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-slate-700 mb-2"><span>Plan</span><span className="font-bold">{plan.title}</span></div>
              <div className="flex items-center justify-between text-sm text-slate-700"><span>Price</span><span className="font-bold">{plan.price}{plan.per}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStage('select')} className="px-4 py-2 rounded-xl border">Back</button>
              <button onClick={() => { setStage('success'); onConfirm?.(plan.id); }} className="px-4 py-2 rounded-xl bg-[#0f172a] text-white font-bold">Confirm (mock)</button>
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
              <button onClick={onClose} className="px-6 py-3 rounded-xl bg-white border">Done</button>
            </div>
          </div>
        )}

        {stage === 'select' && (
          <div className="mt-6 flex items-center justify-between">
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
