# Frontend Rules

## Component Pattern
- Every component gets its own folder: `ComponentName/ComponentName.tsx` + `ComponentName.module.css`
- No exceptions to this pattern
- Desktop and mobile components never share CSS

## Styling
- CSS Modules only, no Tailwind, no inline styles, no CSS-in-JS
- Use CSS custom properties from theme (`var(--color-primary-600)`)
- Mobile-first media queries in every module
- Responsive breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)

## Radix UI
- Use Radix primitives for behavior and accessibility (Dialog, DropdownMenu, Tabs, etc.)
- All visuals go in `*.module.css`, never in Radix props
- Do not use `style` prop on Radix components

## State Management
- Zustand for client state (auth, UI preferences)
- TanStack Query for all API data (transactions, budgets, dashboard)
- No React Context for data fetching

## Nivo Charts
- Use `@nivo/pie` for spending by category
- Use `@nivo/bar` for category breakdowns
- Chart components live inside their page's components folder

## Folder Boundaries
- `shared/components/` — only truly reusable primitives (Button, Card, Input, Modal)
- Page-specific components stay inside `pages/PageName/components/`
- Desktop and mobile pages are completely independent
- Shared business logic only in `shared/` (stores, services, types, utils)
