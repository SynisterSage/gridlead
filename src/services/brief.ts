import { supabase } from '../lib/supabaseClient';

export interface LeadBriefRequest {
  id?: string;
  name?: string;
  category?: string;
  rating?: number;
  website?: string | null;
  notes?: string | null;
}

export interface LeadBrief {
  whyNow: string[];
  talkingPoints: string[];
  opener: string;
  cta: string;
  signals: {
    rating: number | null;
    hasSSL: boolean;
    hasBooking: boolean;
    hasPixel: boolean;
    hasSchema: boolean;
    hasContact: boolean;
    perfMs: number | null;
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
      hasPixel: false,
      hasSchema: false,
      hasContact: false,
      perfMs: null,
    },
  };
};
