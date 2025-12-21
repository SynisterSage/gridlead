# GridLead Design System (Slate & Cobalt)

## Visual Principles
- **Density**: High information density with "breathing room" (p-8 to p-12 on main containers).
- **Depth**: Use of subtle `ring` borders instead of heavy drop shadows.
- **Contrast**: Text must always pass AA accessibility in both modes.

## Token Palette
### Dark Mode
- **Foundation**: `slate-950` (#020617)
- **Surface**: `slate-900` (#0f172a)
- **Nested Surface**: `slate-800` (#1e293b)
- **Accent (Primary)**: `white` or `sky-400`
- **Accent (Alert)**: `rose-500`
- **Accent (Success)**: `emerald-500`

### Light Mode
- **Foundation**: `white`
- **Surface**: `slate-50`
- **Nested Surface**: `white` (bordered)
- **Accent (Primary)**: `slate-900`

## Components
### Cards
- **Radius**: `rounded-[2.5rem]` (Outer), `rounded-3xl` (Inner).
- **Border**: `border border-slate-100 dark:border-slate-800`.
- **Highlight**: `ring-1 ring-slate-100/50 dark:ring-slate-800/50`.

### Typography
- **Headlines**: `Inter`, `font-extrabold`, `tracking-tighter`.
- **Data Labels**: `Inter`, `font-bold`, `text-[9px]`, `uppercase`, `tracking-widest`.
- **Metrics**: `JetBrains Mono`, `font-bold`.

## Interaction Logic
- **Hover States**: Cards should scale slightly (`scale-[1.01]`) or increase border contrast.
- **Active States**: Buttons use `active:scale-95` for tactile feedback.
- **Transitions**: Global `duration-300` or `duration-500` for layout shifts.
