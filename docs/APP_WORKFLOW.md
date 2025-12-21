# App Workflow & Functional Logic

## 1. Discovery Phase
- **User Intent**: "I need new potential clients in a specific area."
- **Action**: Search Niche + Radius.
- **State Transition**: `google_places_api` -> `pre_audit_logic` -> UI Card Display.
- **Persistence**: Clicking "Stage for Review" performs an `INSERT` into the Supabase `leads` table with `status: 'pending'`.

## 2. Review Phase (The Gatekeeper)
- **User Intent**: "Which of these leads actually needs my services?"
- **Logic**:
    - **Visual Audit**: User sees a screenshot of the site (stored in Supabase Storage).
    - **Deep Analysis**: User triggers a real-time audit. AI analyzes the tech-stack and performance.
- **Action**: 
    - **Approve**: Sets `status: 'approved'`. This lead is now a "Qualified Opportunity."
    - **Discard**: Sets `status: 'rejected'` or soft-deletes.

## 3. Outreach Phase (The Action)
- **User Intent**: "I want to start a conversation with this qualified lead."
- **Logic**:
    - **Drafting**: Gemini pulls the audit data to create a custom pitch.
    - **Dispatch**: Email is sent via connected Gmail API.
- **State Transition**: `status` moves from `approved` to `sent`.
- **Engagement**: If a reply is detected, status moves to `responded`.

## 4. Dashboard (The pulse)
- **User Intent**: "How is my business doing this week?"
- **Data Points**:
    - **Revenue Progress**: Sum of `won` leads * deal size vs. user-defined monthly goal.
    - **Pipeline Velocity**: Number of leads moving through the statuses per day.
    - **Dispatch Insight**: AI-suggested "Best time to send" based on past reply timestamps.