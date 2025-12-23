
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
  status: 'pending' | 'approved' | 'rejected' | 'sent' | 'responded' | 'won';
  sentAt?: number; 
  draftSubject?: string;
  draftBody?: string;
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
