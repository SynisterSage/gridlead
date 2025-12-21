# GridLead UX Guidelines

## Interaction Patterns
- **The "Slide" Transition**: Use `animate-in fade-in slide-in-from-right` when switching between leads in the list view to give a "physical" workspace feel.
- **Glassmorphism**: Use `backdrop-blur` on the `NavigationDock` and Success overlays.
- **Feedback**: Every action (Approve, Send, Delete) must trigger a visual state change or a success toast.

## Dark Mode "Tokens"
- **Surface 0**: `slate-950` (The Floor)
- **Surface 1**: `slate-900` (Main Cards)
- **Surface 2**: `slate-800` (Inner inputs/sidebars)
- **Border**: `slate-800` (Subtle separation)
- **Primary Text**: `slate-100`
- **Secondary Text**: `slate-400`
- **Muted Text**: `slate-600`
