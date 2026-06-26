# UI/UX Rules

## Theme System
- All colors, spacing, and breakpoints defined in `shared/theme/theme.ts`
- ThemeProvider injects tokens as CSS custom properties
- Components reference themes via `var(--token-name)`, never hardcoded values
- Dark mode via `[data-theme="dark"]` selector, zero JS cost

## Mobile vs Desktop Separation
- Desktop and mobile have completely separate component trees
- No shared CSS between desktop and mobile
- `main.tsx` detects device and renders either `DesktopApp` or `MobileApp`
- Shared business logic lives in `shared/`, UI never crosses boundaries

## Mobile UX
- Bottom tab bar navigation (thumb-reachable)
- FAB for primary action (add transaction)
- Bottom sheet for input, not modals
- Swipe gestures for delete/reveal
- Full-screen pages with no horizontal scroll
- Touch targets minimum 44x44px

## Desktop UX
- Persistent sidebar navigation
- Top bar with user menu, dark mode toggle, search
- Keyboard shortcuts documented and consistent
- Multi-column layouts with adequate whitespace
- Hover states on all interactive elements
- Command palette (Ctrl+K) for power users

## Responsive Design
- Mobile-first media queries in every `.module.css`
- Breakpoints match theme: 640px / 768px / 1024px / 1280px
- Test at all breakpoints before considering a component done
- No horizontal scroll on any device
