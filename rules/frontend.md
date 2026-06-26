# Frontend Rules

## Component Pattern
- Named arrow function exports only: `export const ComponentName = () => {`
- No default exports, no `function` keyword for components
- Page/layout components each have their own folder: `ComponentName/ComponentName.tsx` + `ComponentName.module.css`
- Desktop and mobile components never share CSS

## Radix UI
- Use `@radix-ui/themes` components directly — Button, Card, TextField, Dialog, Select, DropdownMenu, etc.
- No custom wrappers around Radix components; import and use them as-is
- Custom styling via `className` + CSS Modules for layout tweaks only
- Radix handles all visuals and theming via its token system

## Styling
- Use Radix CSS custom properties: `var(--space-4)`, `var(--orange-9)`, `var(--gray-3)`, etc.
- CSS Modules only for layout and page-specific styles, no Tailwind, no inline styles, no CSS-in-JS
- Mobile-first media queries in every module
- Responsive breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)

## State Management
- Zustand for client state (auth, UI preferences)
- TanStack Query for all API data (transactions, budgets, dashboard)
- No React Context for data fetching

## Nivo Charts
- Use `@nivo/pie` for spending by category
- Use `@nivo/bar` for category breakdowns
- Chart components live inside their page's components folder

## Folder Boundaries
- `shared/` — business logic only (stores, services, types, utils, theme)
- `desktop/` — desktop-specific layouts, pages, and components
- `mobile/` — mobile-specific layouts, pages, and components
- Desktop and mobile are completely independent; no cross-imports
- No `shared/components/` — use Radix Themes components directly
