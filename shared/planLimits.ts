export type PlanTier = 'starter' | 'studio' | 'agency_waitlist';

export interface PlanLimits {
  leadLimit: number | null; // null = unlimited
  senderLimit: number | null;
  auditDepth: 'light' | 'deep' | 'full';
  canUseGemini: boolean;
  label: string;
  description: string;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: {
    leadLimit: 50,
    senderLimit: 2,
    auditDepth: 'light',
    canUseGemini: false,
    label: 'Starter',
    description: 'Free tier with light audits and 2 sender seats.',
  },
  studio: {
    leadLimit: 1000,
    senderLimit: 5,
    auditDepth: 'deep',
    canUseGemini: true,
    label: 'Studio',
    description: 'Paid tier with deep audits, rotation, and AI outreach.',
  },
  agency_waitlist: {
    leadLimit: null,
    senderLimit: null,
    auditDepth: 'full',
    canUseGemini: true,
    label: 'Agency+',
    description: 'In-development tier; treat as unlimited once activated.',
  },
};

export const getPlanLimits = (plan?: string | null): PlanLimits => {
  if (!plan) return PLAN_LIMITS.starter;
  const normalized = plan.toLowerCase() as PlanTier;
  return PLAN_LIMITS[normalized] ?? PLAN_LIMITS.starter;
};

export const isOverLeadLimit = (
  plan: string | null | undefined,
  leadsUsed: number
): boolean => {
  const { leadLimit } = getPlanLimits(plan);
  return leadLimit !== null && leadsUsed >= leadLimit;
};

export const isOverSenderLimit = (
  plan: string | null | undefined,
  seatsUsed: number
): boolean => {
  const { senderLimit } = getPlanLimits(plan);
  return senderLimit !== null && seatsUsed >= senderLimit;
};
