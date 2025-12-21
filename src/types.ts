
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
  category: string;
  rating: number;
  lastScan: string;
  website: string;
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
