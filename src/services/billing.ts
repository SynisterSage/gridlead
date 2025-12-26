import { supabase } from '../lib/supabaseClient';

export type PlanKey = 'studio' | 'agency' | 'starter';

export const startCheckout = async (plan: PlanKey = 'studio'): Promise<{ url?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke<{ url: string }>('stripe-checkout', {
    body: { planId: plan },
  });
  if (error) {
    return { error: error.message || 'Unable to start checkout' };
  }
  return { url: data?.url };
};

export const openCustomerPortal = async (): Promise<{ url?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke<{ url: string }>('stripe-portal', {
    body: {},
  });
  if (error) {
    return { error: error.message || 'Unable to open billing portal' };
  }
  return { url: data?.url };
};
