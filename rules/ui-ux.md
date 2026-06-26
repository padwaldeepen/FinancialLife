# UI/UX Rules

## Theme System
- `src/theme.tsx` wraps Radix `<Theme>` with accentColor="orange", grayColor="slate"
- Use Radix CSS tokens: `var(--space-4)`, `var(--orange-9)`, `var(--gray-3)`, etc.
- No hardcoded colors — always use Radix token variables
- Dark mode via Radix `appearance` prop, set once at root

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
