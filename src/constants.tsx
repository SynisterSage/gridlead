
import { Lead, Campaign } from './types';

export const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    name: 'Glow Coffee House',
    category: 'Café',
    rating: 3.2,
    lastScan: '2h ago',
    website: 'glowcoffee.io',
    status: 'pending',
    score: { design: 45, performance: 60, reviews: 30, trust: 80 },
    notes: 'Website is slow on mobile. Great local following though.'
  },
  {
    id: '2',
    name: 'Iron Forge Gym',
    category: 'Fitness',
    rating: 4.8,
    lastScan: '5h ago',
    website: 'ironforge.net',
    status: 'pending',
    score: { design: 20, performance: 15, reviews: 90, trust: 50 },
    notes: 'No mobile optimization. SEO is virtually non-existent.'
  },
  {
    id: '3',
    name: 'Zen Floral Studio',
    category: 'Retail',
    rating: 2.1,
    lastScan: '1d ago',
    website: 'zenfloral.com',
    status: 'pending',
    score: { design: 70, performance: 80, reviews: 10, trust: 20 },
    notes: 'Needs better review management strategy.'
  }
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'c1',
    name: 'Downtown Cafes Outreach',
    status: 'scheduled',
    steps: [
      { id: 's1', title: 'Intro', subject: 'Your website speed', body: 'Hello {{name}}, I noticed...', delay: 'Immediate' },
      { id: 's2', title: 'Follow-up', subject: 'Quick question', body: 'Just circling back...', delay: '2 days' }
    ]
  }
];
