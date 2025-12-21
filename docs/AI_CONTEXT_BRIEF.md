# AI Developer Context Brief

If you are an AI agent tasked with building GridLead, adhere to these technical and aesthetic rules:

## Design Language
- **Palette**: Slate-based. `slate-950` for dark mode backgrounds, `slate-900` for cards. `slate-50` for light mode.
- **Typography**: Inter for UI, JetBrains Mono for scores and technical data.
- **Visual Cues**: Use high-contrast badges (Draft, Sent, Won) and mono-font ratings (e.g., `4.2`).
- **Radius**: Large border-radii (`3xl`, `full`, `rounded-[2.5rem]`) to give a modern "SaaS 3.0" feel.

## Component Architecture
- **State Management**: Currently lifted to `App.tsx` for simplicity in the prototype. For production, move to a specialized `LeadsContext`.
- **Gemini Service**: All AI logic lives in `services/geminiService.ts`. Use `gemini-3-flash-preview` for speed and cost-effectiveness in text tasks.
- **The "Thread" Logic**: A lead moves through a linear status pipeline: `pending` -> `approved` -> `sent` -> `responded` -> `won`.

## Key Files to Watch
- `components/ReviewQueue.tsx`: The primary decision-making hub.
- `components/OutreachBuilder.tsx`: The revenue-generating hub.
- `components/HeroDiscovery.tsx`: The top-of-funnel entry point.
