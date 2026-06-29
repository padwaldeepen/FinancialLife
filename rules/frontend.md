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
- All theming via `theme.tsx` which wraps `<Theme accentColor="orange" grayColor="slate">`
- `useAppTheme()` hook for dark mode toggle: `const { dark, toggle } = useAppTheme()`
- Use Radix CSS tokens exclusively — never hardcode colors:
  - Backgrounds: `var(--gray-1)`, `var(--gray-2)`, `var(--color-panel)`, `var(--color-panel-solid)`
  - Borders: `var(--gray-4)`, `var(--gray-5)`, `var(--gray-6)`
  - Text: `var(--gray-12)` (primary), `var(--gray-11)` (secondary), `var(--gray-10)` (tertiary)
  - Accent: `var(--accent-9)`, `var(--accent-10)`, `var(--accent-11)`, `var(--accent-contrast)`
  - Semantic: `var(--red-9)` (error), `var(--green-9)` (success), `var(--orange-9)` (warning)
  - Spacing: `var(--space-1)` through `var(--space-9)`
  - Radius: `var(--radius-1)` through `var(--radius-4)`
  - Font size: `var(--font-size-1)` through `var(--font-size-8)`
- Dark mode through Radix `appearance` prop — no separate CSS variables

## CSS Modules
- One `.module.css` per component, co-located in the same folder
- Only layout and positioning in CSS modules — no colors, fonts, or spacing that Radix provides
- Class naming: camelCase (automatically transformed by Vite)
- Media queries: mobile-first, breakpoints at 640/768/1024/1280px
- No `@apply`, no Tailwind directives, no CSS-in-JS, no inline styles
- Always use Radix spacing tokens: `padding: var(--space-4)` not `padding: 16px`
- Exception: third-party components that render outside the theme tree (e.g. react-hot-toast `Toaster`) may use inline styles since CSS variables are out of scope

## State Management
- Zustand (bound store pattern) for ALL global state — auth, transactions, budgets, UI
- `useState` for LOCAL form state only: email, password, loading flags, error messages
- All API calls go inside Zustand slice actions, using `api` from `auth/api.ts`
- No TanStack Query / React Query — use Zustand actions with axios instead
- No React Context for data fetching or global state
- AuthContext is the one exception — it provides `useAuth()` for consuming auth state, but the actual data lives in Zustand

### useState vs Zustand — Decision Guide

| Scenario | Tool | Example |
|----------|------|---------|
| Form inputs (email, password) | `useState` | `const [email, setEmail] = useState('')` |
| Form validation errors | `useState` | `const [errors, setErrors] = useState({})` |
| Form submission loading | `useState` | `const [loading, setLoading] = useState(false)` |
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
Consumers access state as `s.auth.user` and actions as `s.login()`.

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
- No `shared/components/` — use Radix Themes components directly
