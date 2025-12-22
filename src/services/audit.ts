import { supabase } from '../lib/supabaseClient';

export interface AuditResult {
  scores: {
    design: number;
    performance: number;
    reviews: number;
    trust: number;
  };
  checklist: {
    mobileOptimization: boolean;
    sslCertificate: boolean;
    seoPresence: boolean;
    conversionFlow: boolean;
  };
  summary: string;
}

export const runAudit = async (url: string, leadId?: string): Promise<AuditResult> => {
  const { data, error } = await supabase.functions.invoke<AuditResult>('review-audit', {
    body: { url, leadId },
  });
  if (error) {
    throw new Error(error.message || 'Audit failed');
  }
  return data as AuditResult;
};
