# GridLead Design Guide

## Visual Signature
GridLead uses a "Modern Industrial" aesthetic. It prioritizes data density without sacrificing whitespace.

## Color Tokens (Tailwind)
### Dark Mode (Primary)
*   **Background (Level 0)**: `bg-slate-950` (#020617) - The deep foundation.
*   **Surface (Level 1)**: `bg-slate-900` (#0f172a) - Primary cards and navigation.
*   **Surface (Level 2)**: `bg-slate-800` (#1e293b) - Nested inputs and secondary sidebars.
*   **Border**: `border-slate-800` or `border-slate-100/10`.
*   **Text (Primary)**: `text-slate-100`.
*   **Text (Muted)**: `text-slate-500`.

### Light Mode
*   **Background**: `bg-white`.
*   **Surface**: `bg-slate-50`.
*   **Text**: `text-slate-900`.

## Typography
*   **UI/Body**: `Inter` (Sans-serif). Use `font-bold` for all labels.
*   **Data/Scores**: `JetBrains Mono`. Used for percentages, ratings, and IDs.

## Interaction Patterns
1.  **Borders**: All cards should have a `ring-1 ring-slate-100/50` (light) or `ring-slate-800/50` (dark) to create depth.
2.  **Corner Radius**:
    *   Container: `rounded-[2.5rem]`
    *   Cards: `rounded-[2rem]`
    *   Buttons: `rounded-xl`
3.  **Transitions**: Use `cubic-bezier(0.4, 0, 0.2, 1)` for all theme and state transitions.

## Accessibility
*   Maintain a minimum contrast ratio of 4.5:1 for all primary body text.
*   Every interactive icon must have an `aria-label`.
*   Keyboard navigation must support `Tab` cycling through leads in the Review Queue.
