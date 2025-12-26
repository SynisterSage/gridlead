
export enum AppView {
  DISCOVERY = 'discovery',
  DASHBOARD = 'dashboard',
  QUEUE = 'queue',
  CAMPAIGNS = 'campaigns',
  SETTINGS = 'settings'
}

export interface Lead {
  id: string;
  name: string;
  placeId?: string;
  category: string;
  rating: number;
  lastScan: string;
  createdAt?: number;
  updatedAt?: number;
  website: string;
  email?: string;
  user_id?: string;
  address?: string;
  lat?: number;
  lng?: number;
  status: 'pending' | 'approved' | 'rejected' | 'sent' | 'responded' | 'won' | 'stale' | 'lost';
  sentAt?: number; 
  draftSubject?: string;
  draftBody?: string;
  archivedAt?: string | number | null;
  score: {
    design: number;
    performance: number;
    reviews: number;
    trust: number;
  };
  notes: string;
  checklist?: {
    mobileOptimization?: boolean;
    sslCertificate?: boolean;
    seoPresence?: boolean;
    conversionFlow?: boolean;
    hasGoogleReviews?: boolean;
    hasRender?: boolean;
  };
}

export interface CampaignStep {
  id: string;
  title: string;
  subject: string;
  body: string;
  delay: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sent' | 'responded';
  steps: CampaignStep[];
}

export interface Profile {
  id: string;
  display_name?: string;
  agency_name?: string;
  monthly_goal?: number;
  gmail_connected?: boolean;
  onboarding_completed?: boolean;
  created_at?: string;
  updated_at?: string;
  plan?: string | null;
  plan_status?: string | null;
  leads_used_this_month?: number | null;
  sender_seats_used?: number | null;
  stripe_subscription_id?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
  agency_approved?: boolean | null;
  agency_waitlist_status?: string | null;
  agency_waitlist_requested_at?: string | null;
}

export type NotificationType =
  | 'lead'
  | 'lead_assigned'
  | 'reply'
  | 'send_failed'
  | 'gmail_disconnected'
  | 'goal_hit'
  | 'pipeline_threshold'
  | 'weekly'
  | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  created_at: string;
  unread: boolean;
  meta?: Record<string, any>;
}
