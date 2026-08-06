# Frontend Rules

## Component Pattern
- Named arrow function exports only: `export const ComponentName = () => {`
- No default exports, no `function` keyword for components
- Page/layout components each have their own folder: `ComponentName/ComponentName.tsx` + `ComponentName.module.css`
- Desktop and mobile components never share CSS

## Radix UI — HTML Tag Replacement Map

| Never use | Radix replacement |
|-----------|------------------|
| `<div>` | `<Box>`, `<Flex>`, `<Grid>` |
| `<span>`, `<p>` | `<Text>` |
| `<h1>`–`<h6>` | `<Heading>` |
| `<button>` | `<Button>`, `<IconButton>` |
| `<a>` | react-router `<Link>` / `<NavLink>` or Radix `<Link>` |
| `<label>`, `<input>` | `<TextField.Root>` (internal input auto-rendered, put props on Root) |
| `<select>` | `<Select.Root>` / `<Select.Trigger>` / `<Select.Content>` / `<Select.Item>` |
| `<textarea>` | `<TextArea>` |
| `<img>` | `<Avatar>` |
| `<table>` | `<Table.Root>` / `<Table.Header>` / `<Table.Body>` / `<Table.Row>` / `<Table.Cell>` |
| `<hr>` | `<Separator>` |
| `<progress>` | `<Progress>` |
| `<ul>`/`<ol>` | `<DataList>` |
| Card wrapper div | `<Card>` |
| Badge/tag spans | `<Badge>` |
| Tooltip wrapper | `<Tooltip>` |
| Dialog/modal | `<Dialog.Root>` / `<Dialog.Content>` |
| Dropdown menu | `<DropdownMenu.Root>` / `<DropdownMenu.Content>` |
| Tabs | `<Tabs.Root>` / `<Tabs.List>` / `<Tabs.Trigger>` / `<Tabs.Content>` |
| Checkbox | `<Checkbox>` |
| Switch/toggle | `<Switch>` |
| Radio buttons | `<RadioGroup.Root>` / `<RadioGroup.Item>` |
| Callout/alert | `<Callout.Root>` / `<Callout.Text>` / `<Callout.Icon>` |
| Skeleton/loading | `<Skeleton>` |
| Scroll area | `<ScrollArea>` |
| Spinner | `<Spinner>` |

- Semantic HTML elements (`<nav>`, `<main>`, `<header>`, `<aside>`, `<form>`, `<section>`, `<article>`) are fine and preferred for accessibility
- No custom wrappers around Radix components; import and use them as-is
- Custom styling via `className` + CSS Modules for layout tweaks only
- Radix handles all visuals and theming via its token system

## TextField Pattern
`TextField.Root` in `@radix-ui/themes@3.3.0` renders its own internal `<input>` automatically.
**Do NOT add a child `<input>`** — that creates duplicate fields. Put input props directly on `<TextField.Root>`:
```tsx
<TextField.Root
  id="fieldId"
  type="text"
  placeholder="Placeholder"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  className={styles.input}
>
  <TextField.Slot side="left">{icon}</TextField.Slot>
  <TextField.Slot side="right">{action}</TextField.Slot>
</TextField.Root>
```
`className` on `TextField.Root` goes to the root `<div>`. Use it only for layout (e.g. `width: 100%`).
Radix handles all input visuals (padding, border, font, placeholder color) via its `rt-TextFieldInput` class.
Use `color` prop (`"red"`, etc.) on `TextField.Root` for error/invalid states.

## Theme & Color System

`theme.tsx` (`<Theme accentColor="orange" grayColor="slate" radius="large" ...>`) is the
**single source of truth for every color/radius/scaling value in the app** — this is not
a project convention, it's how Radix Themes actually works: `accentColor`/`grayColor`
generate `--accent-*`/`--gray-*` CSS variables that every Radix component and every
correctly-written `.module.css` file reads from. **Change one prop in `theme.tsx`, the
whole app repaints — but only for code that follows the rule below.** ([Radix theme
overview](https://www.radix-ui.com/themes/docs/theme/overview),
[color docs](https://www.radix-ui.com/themes/docs/theme/color))

### The one rule that actually matters here
**Never hardcode a literal Radix color-scale name** (`"orange"`, `"indigo"`, `var(--orange-6)`,
etc.) when what you mean is "the app's accent color." Two ways to do it wrong, and the fix:
```tsx
// WRONG — locks this badge to orange forever, ignores theme.tsx
<Badge color="orange">Pending</Badge>

// RIGHT — omit color entirely; it inherits accentColor from <Theme>
<Badge>Pending</Badge>
```
```css
/* WRONG — hardcodes the orange scale directly */
.pendingCard { border: 1px solid var(--orange-6); }

/* RIGHT — reads from whatever accentColor is set to */
.pendingCard { border: 1px solid var(--accent-6); }
```
`color`/named-scale props and vars are still correct for **money semantics** (an intentional,
documented exception — `var(--green-11)` for income, `var(--red-11)` for expense/destructive,
per `docs/design-system.md` §1) and for anything genuinely meant to stay that color regardless
of theme (there is currently nothing else in this app that qualifies). Everything else that
means "the app's one accent" must go through `--accent-*` or an unset `color` prop, or a future
`accentColor` change in `theme.tsx` silently won't reach it.

- `useAppTheme()` hook for dark mode toggle: `const { dark, toggle } = useAppTheme()`.
  Dark mode is the `appearance` prop + a `data-theme` attribute switch — never hand-pick
  separate dark-mode color values; the same `--gray-*`/`--accent-*` variables resolve to
  different actual colors automatically. ([dark mode docs](https://www.radix-ui.com/themes/docs/theme/dark-mode))
- Token reference (use these, not raw px/hex, in every `.module.css`):
  - Backgrounds: `var(--gray-1)`, `var(--gray-2)`, `var(--color-panel)`, `var(--color-panel-solid)`
  - Borders: `var(--gray-4)`, `var(--gray-5)`, `var(--gray-6)`
  - Text: `var(--gray-12)` (primary), `var(--gray-11)` (secondary), `var(--gray-10)` (tertiary)
  - Accent, by step (12-step scale, same shape as gray): steps 1–2 backgrounds, 3–5
    interactive states (hover/pressed fills), 6–8 borders/separators, 9–10 solid/prominent
    (buttons, the hero-card stripe), 11–12 high-contrast text. Plus semantic aliases
    `var(--accent-contrast)` (text/icon color *on* a solid accent-9 fill), `var(--accent-surface)`,
    `var(--accent-indicator)`, `var(--accent-track)`.
  - Spacing: `var(--space-1)` (4px) through `var(--space-9)` (64px) — never a raw px margin/padding
  - Radius: `var(--radius-1)` through `var(--radius-6)`, plus `var(--radius-full)` (pills) and
    `var(--radius-thumb)`. The theme's `radius` prop is a multiplier applied contextually per
    component — `Card`/`Dialog`/`Popover` panels always inherit the theme radius and don't take
    a `radius` prop at all. (`--radius-card`/`--radius-section` in `design-tokens.css` are this
    project's aliases on top of that scale — keep using those, don't reintroduce raw `--radius-N`
    in page CSS.) ([radius docs](https://www.radix-ui.com/themes/docs/theme/radius))
  - Font size: `var(--font-size-1)` through `var(--font-size-9)` — each step bundles size +
    line-height + letter-spacing together, so prefer the `size` prop on `<Text>`/`<Heading>`
    over raw CSS wherever the content is inside one of those components. A hand-picked pixel
    size in `.module.css` (e.g. the 48px hero balance number) is only acceptable for a genuinely
    one-off display number bigger than the scale goes — not as a habit.
    ([typography docs](https://www.radix-ui.com/themes/docs/theme/typography))
  - **Shadows are a real 6-step token set (`--shadow-1`..`--shadow-6`) that this app
    deliberately never uses** — `docs/design-system.md` §2 is flat/no-shadow by design. Don't
    add `box-shadow: var(--shadow-N)` to "make a card pop"; that's reintroducing depth the
    design intentionally removed.

### Prefer layout props over custom CSS
`Box`/`Flex`/`Grid`/`Section`/`Container` accept the full spacing/sizing scale as props
(`gap="3"`, `p="4"`, `maxWidth="...`) and support responsive object values
(`size={{ initial: '2', md: '4' }}`) — reach for these before writing layout rules in
`.module.css`. Radix's own breakpoints (`xs` 520px, `sm` 768px, `md` 1024px, `lg` 1280px,
`xl` 1640px, all `min-width`) exist for exactly this. This project's actual device split
(`desktop/` vs `mobile/` trees) means these are rarely needed — the only real media queries
in the codebase today collapse the desktop sidebar at `1024px`, which lines up with Radix's
own `md` breakpoint. If a component ever needs a real in-tree responsive breakpoint, use
`1024px` (matches `md`) rather than inventing a new number.
([breakpoints docs](https://www.radix-ui.com/themes/docs/theme/breakpoints),
[layout docs](https://www.radix-ui.com/themes/docs/overview/layout))

### Known debt — card-shape duplication
14 `.module.css` files each independently redeclare the same "card" shape (`border: 1px
solid var(--gray-4); border-radius: var(--radius-card); padding: var(--space-4)`) as their
own local class instead of one shared class. Don't add a 15th copy — and if you're touching
one of the existing ones for an unrelated reason, it's fine to leave it as-is (this is a
scoped future refactor, not something to fix incidentally mid-unrelated-change).

## CSS Modules
- One `.module.css` per component, co-located in the same folder
- Only layout and positioning in CSS modules — no colors, fonts, or spacing that Radix provides
- Class naming: camelCase (automatically transformed by Vite)
- Media queries are rare here (desktop/mobile are separate trees, not one fluid
  responsive layout) — see "Prefer layout props over custom CSS" above for when one's
  actually needed and which breakpoint to use
- No `@apply`, no Tailwind directives, no CSS-in-JS, no inline styles
- Always use Radix spacing tokens: `padding: var(--space-4)` not `padding: 16px`

## State Management
- Zustand (bound store pattern) for ALL global state — auth, transactions, budgets, UI
- **`useState` only for a single, truly local flag** (e.g. one `showPassword` boolean
  with nothing else). The moment a component holds two or more pieces of state —
  including per-form, transient-until-submit state like a login/register form — it goes
  in a Zustand slice instead. See `rules/zustand.md` for the full rule and the worked
  examples (`registerFormSlice.ts`, `loginFormSlice.ts`).
- All API calls go inside Zustand slice actions, using `api` from `shared/api/client.ts`
- No TanStack Query / React Query — use Zustand actions with axios instead
- No React Context for data fetching or global state

### useState vs Zustand — Decision Guide

| Scenario | Tool | Example |
|----------|------|---------|
| One local flag, nothing else in the component | `useState` | `const [showPassword, setShowPassword] = useState(false)` |
| Form inputs, validation errors, submit-loading (2+ fields together) | Zustand | `s.loginForm.email`, `s.registerForm.errors` |
| Auth user, token | Zustand | `s.auth.user`, `s.auth.token` |
| Transaction list, budget data | Zustand | `s.transactions`, `s.budgets` |
| UI state (sidebar open, modal) | Zustand | `s.ui.sidebarOpen` |

### useShallow — When to Use
Import from `zustand/react/shallow`. Use when selecting an object with **multiple values** from the store to prevent unnecessary re-renders:
```tsx
// CORRECT — useShallow for multi-value selectors
const { user, token } = useBoundStore(
  useShallow((s) => ({ user: s.auth.user, token: s.auth.token })),
)

// NOT NEEDED — single primitive selector
const loading = useBoundStore((s) => s.auth.loading)

// NOT NEEDED — single action selector
const logout = useBoundStore((s) => s.logout)
```

### immer Middleware
The store uses `immer` middleware for immutable updates with mutable syntax. All state mutations in slice actions can use direct assignment:
```ts
set({ user: null, token: null, loading: false })  // fine
// Instead of: set((s) => ({ auth: { ...s.auth, user: null } }))
```

### namespaceSlice Pattern
Each slice uses the `namespaceSlice` helper from `store/namespaceSlice.ts` to auto-namespace state under a key while keeping actions flat:
```ts
export const createAuthSlice = namespaceSlice('auth', (set, get) => ({
  // state fields — go under s.auth.*
  user: null as User | null,
  token: null as string | null,

  // action fields — stay flat at top level
  login: async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password })
    set({ token: res.data.access_token, user: res.data.user })
  },
}))
```
Consumers access both state and actions under the namespace: `s.auth.user`, `s.auth.login()`.

## Nivo Charts
- Use `@nivo/pie` for spending by category
- Use `@nivo/bar` for category breakdowns
- Chart components live inside their page's components folder

## Formatting & Linting
- Lint with ESLint: `npm run lint` (check) and `npm run lint:fix` (auto-fix)
- Format with Prettier: `npm run format` (check) and `npm run format:fix` (write)
- Run both after every change — `npm run lint:fix && npm run format:fix`
- TypeScript check: `npm run typecheck`

## Folder Boundaries
- `shared/` — business logic only (stores, services, types, utils, theme)
- `desktop/` — desktop-specific layouts, pages, and components
- `mobile/` — mobile-specific layouts, pages, and components
- Desktop and mobile are completely independent; no cross-imports
- No `shared/components/` for presentational/Radix-wrapper components — use Radix Themes
  components directly, never a custom wrapper around one. The one legitimate exception is
  cross-device **logic** with no meaningful visual surface of its own, e.g.
  `shared/components/ProtectedRoute/` — an auth-gate redirect used identically by both
  `DesktopApp.tsx` and `MobileApp.tsx` (DRY: one implementation, not two copies). If a
  "shared component" candidate has real page-specific layout/styling, it belongs in
  `desktop/`/`mobile/` instead, per the CSS-never-shared rule above.
- **Don't split out a component/file for 3-4 lines of markup used exactly once.** A
  small block of JSX (a label + a value, a single conditional row) stays inline in its
  parent unless it's reused elsewhere or the parent is already unreadably long. A new
  file is justified by genuine reuse or genuine size, not by "everything gets its own
  component" as a default habit — that's over-engineering, not organization.
- **Before writing new CSS or a new file, check three things in order**: (1) does a
  Radix prop already do this (`size`, `weight`, `color`, `gap`, `mb`, ...) — if so, use
  the prop, no CSS at all; (2) does this belong at the shared-layout level instead of
  per-page (e.g. an animation/spacing/positioning rule identical across many pages
  belongs in that tree's layout component, not redeclared in every page's
  `.module.css`); (3) only if neither covers it, write scoped CSS in that component's
  own `.module.css`. A component needing zero real custom styling doesn't get an empty
  or near-empty `.module.css` file just because that's the usual pattern.
