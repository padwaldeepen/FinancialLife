# UI/UX Rules

> Full design spec: `docs/design-system.md`. These are the enforcement rules while coding.

## One Theme File Controls All Colors
- `src/theme.tsx` (Radix `<Theme accentColor="orange" grayColor="slate">`) +
  `src/styles/design-tokens.css` are the ONLY places color is defined
- Components consume Radix tokens: `var(--slate-3)`, `var(--orange-9)`, `var(--space-4)`
- NO hex codes, rgb(), hsl(), or named colors anywhere in `.module.css` files
- Dark mode via Radix `appearance` at the root only — never hand-picked dark variants
- Test: changing `accentColor` in theme.tsx must restyle the whole app

## Three-Color System
- **Paper**: slate 1–5 (backgrounds, cards, borders)
- **Ink**: slate 9–12 (all text, icons, dividers)
- **Accent**: orange 9–11 — actions only (primary buttons, active nav, focus, links)
- Money exception (narrow): `green-11` / `red-11` on **amounts only** — never on
  containers, badges, icons, or chart backgrounds
- No other hues. Category colors from the DB are not rendered as colors (name + icon only)
- Max ~3 accent elements visible per screen — accent means "the action"
- Charts: Nivo ONLY (no other chart lib, no hand-rolled SVG); accent for the
  selected/current series, slate steps for everything else

## Alignment & Spacing
- Radix space tokens only (`var(--space-1..9)`); no raw px margins/paddings
- Desktop: sidebar 240px + centered content `max-width: 1200px`; cards snap to a 12-col grid
- Mobile: single column, `var(--space-4)` side padding on EVERY screen
- Section gaps: `var(--space-5)` mobile, `var(--space-6)` desktop — always
- Cards: `var(--space-4)` padding, `var(--radius-card)` (design-tokens.css alias for
  `--radius-4`), 1px slate-4 border, no shadows
- Amounts: right-aligned, `font-variant-numeric: tabular-nums`

## Device Roles & Page Map (feature parity is a NON-goal)
- **Desktop = 5 pages only**: Home · Activity · Recurring · Insights · Manage
  (see `docs/design-system.md` §3) — never add a top-level page per DB table;
  maintenance UIs (categories, merchants, goals CRUD, admin) are tabs inside Manage
- **Mobile = 3 tabs + capture**: Home · Activity · Capture; settings behind avatar;
  NO admin, CSV mapping, merchant merge, hierarchy management, reports, or bulk edit
- Desktop is keyboard-first (Cmd/Ctrl+N quick-add, / search, Esc closes dialogs)
- Layouts/CSS never shared between trees; logic, hooks, formatting always shared

## States (every screen)
- Empty: slate icon + one sentence + one accent action — never a blank rectangle
- Loading: Radix `<Skeleton>` shaped like the content; no spinners or "Loading..." text
- Insufficient data (insights/forecast): say it plainly ("Need ~2 months of data")
- Confirmations: Radix `<AlertDialog>`; `window.confirm()` is banned
- Touch targets ≥ 44x44px on mobile; hover states on all desktop interactive elements
