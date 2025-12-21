# GridLead Data Models

## Lead Object (`Lead`)
The primary entity. Every action revolves around the Lead.

```typescript
interface Lead {
  id: string;
  name: string;
  category: string;
  rating: number; // Google Maps rating
  lastScan: string;
  website: string;
  status: 'pending' | 'approved' | 'rejected' | 'sent' | 'responded' | 'won';
  score: {
    design: number;      // 0-100 (Visual Audit)
    performance: number; // 0-100 (Speed Audit)
    reviews: number;     // 0-100 (Market Sentiment)
    trust: number;       // 0-100 (Security/SSL)
  };
  notes: string;         // AI-generated hooks and manual notes
}
```

## Scoring Logic
- **Total Rating**: Calculated as a weighted average.
- **The "Gap" Opportunity**: Leads with high `reviews` but low `performance` or `design` are the highest priority. It means they are a good business with a bad digital front door.
