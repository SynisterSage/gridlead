import { supabase } from '../lib/supabaseClient';

export interface LeadBriefRequest {
  id?: string;
  name?: string;
  category?: string;
  rating?: number;
  reviews_count?: number | null;
  website?: string | null;
  notes?: string | null;
}

export interface LeadBrief {
  whyNow: string[];
  talkingPoints: string[];
  opener: string;
  cta: string;
  evidence?: string[];
  signals: {
    htmlFetched?: boolean;
    rating: number | null;
    reviewsCount?: number | null;
    hasSSL: boolean;
    hasBooking: boolean;
    hasForm: boolean;
    ctaText: string | null;
    hasPixel: boolean;
    hasSchema: boolean;
    hasContact: boolean;
    hasMap: boolean;
    perfMs: number | null;
    statusCode: number | null;
    auditScore?: {
      design?: number | null;
      performance?: number | null;
      trust?: number | null;
      reviews?: number | null;
    };
    auditChecklist?: {
      mobileOptimization?: boolean | null;
      sslCertificate?: boolean | null;
      seoPresence?: boolean | null;
      conversionFlow?: boolean | null;
      hasGoogleReviews?: boolean | null;
      hasRender?: boolean | null;
    };
    lastStatus?: number | null;
  };
}

export const fetchLeadBrief = async (lead: LeadBriefRequest): Promise<LeadBrief> => {
  const { data, error } = await supabase.functions.invoke<LeadBrief>('lead-brief', {
    body: { lead },
  });
  if (error) {
    throw new Error(error.message || 'Failed to fetch lead brief');
  }
  return (data as LeadBrief) || {
    whyNow: [],
    talkingPoints: [],
    opener: '',
    cta: '',
    signals: {
      rating: null,
      hasSSL: false,
      hasBooking: false,
      hasForm: false,
      ctaText: null,
      hasPixel: false,
      hasSchema: false,
      hasContact: false,
      hasMap: false,
      perfMs: null,
      statusCode: null,
    },
  };
};
