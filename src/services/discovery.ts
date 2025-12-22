import { supabase } from '../lib/supabaseClient';
import { Lead } from '../types';

export interface DiscoverParams {
  query: string;
  location?: { zip?: string; city?: string; lat?: number; lng?: number };
  radiusKm?: number;
  minRating?: number;
  pageToken?: string;
}

export interface DiscoverResult {
  results: Array<{
    id: string;
    placeId: string;
    name: string;
    category?: string | null;
    rating?: number | null;
    website?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    potentialScore: number;
    notes?: string | null;
  }>;
  nextPageToken?: string;
}

export const runDiscover = async (params: DiscoverParams): Promise<DiscoverResult> => {
  const { data, error } = await supabase.functions.invoke<DiscoverResult>('discover', {
    body: params,
  });
  if (error) {
    throw new Error(error.message || 'Discovery failed');
  }
  return data || { results: [] };
};

export const stageLeadPayloadFromResult = (item: DiscoverResult['results'][number]): Lead => {
  return {
    id: item.id,
    placeId: item.placeId,
    name: item.name,
    category: item.category || 'Business',
    rating: typeof item.rating === 'number' ? item.rating : 0,
    lastScan: 'Just now',
    website: item.website || 'No website found',
    address: item.address || undefined,
    lat: item.lat || undefined,
    lng: item.lng || undefined,
    status: 'pending',
    score: {
      design: item.potentialScore,
      performance: Math.max(10, Math.min(100, item.potentialScore - 5)),
      reviews: item.rating ? Math.round((5 - item.rating) * 20) : 50,
      trust: Math.max(10, Math.min(100, item.potentialScore + 5)),
    },
    notes: item.notes || 'Discovered via Places search.'
  };
};
