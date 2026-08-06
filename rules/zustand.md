# Zustand Rules

## When state goes in Zustand vs `useState`

**Rule (decided 2026-07-17, owner's call): if a component holds more than one piece of
state, it goes in Zustand — not `useState`.** A single, truly local flag (e.g. one
`showPassword` boolean with nothing else) may stay `useState`; the moment a component
needs two or more pieces of state (form fields, a dialog's open flag plus its draft
values, etc.), give it a Zustand slice instead. This applies even to per-form,
transient-until-submit state like a registration form — put it in a slice, not a block
of `useState` calls.

- Server-owned/shared state (settings, fetched lists, anything another component or a
  reload should see) was always Zustand — unchanged.
- Now also Zustand: any component-local state once it's more than one field. Example:
  `Register.tsx`'s form (`fullName`, `username`, `email`, `password`, `confirmPassword`,
  `country`, `showPassword`, `errors`) moved into `store/slices/registerFormSlice.ts`
  (`resetRegisterForm` clears it on mount/unmount so stale data doesn't leak between
  visits — the one behavior a naive move to Zustand would otherwise regress).
- Pattern for a form slice: fields flat under the namespace, a `setField(name, value)`
  action (or one setter per field), a `reset()` action components call in a mount
  `useEffect` — see `registerFormSlice.ts`.

## Store Architecture

- Single bound store at `store/useBoundStore.ts` combining all slices
- Each domain gets a slice file in `store/slices/` (e.g. `authSlice.ts`)
- `useBoundStore` is the only store import — never import slices directly

## Creating a Slice

Use `namespaceSlice` helper from `store/namespaceSlice.ts`. It namespaces both state fields
and actions under one key — `namespaceSlice(name, creator)` returns `{ [name]: creator(...) }`,
so everything the creator returns (state *and* actions) lives under `s.<name>.*`.

```ts
// store/slices/authSlice.ts
import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'

export type AuthSlice = {
  auth: AuthState & AuthActions
}

export const createAuthSlice = namespaceSlice('auth', (set, get) => ({
  // State — goes under s.auth.*
  user: null as User | null,
  token: null as string | null,
  loading: true,

  // Actions — also under s.auth.*, called as s.auth.login(...)
  login: async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password })
    set({ token: res.data.access_token, user: res.data.user })
  },

  logout: async () => {
    await api.post('/api/auth/logout').catch(() => {})
    set({ token: null, user: null })
  },
}))
```

## Combining Slices

Add each slice to `useBoundStore.ts` with `immer` middleware:

```ts
// store/useBoundStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createAuthSlice } from './slices/authSlice.ts'
import type { StoreState } from './types.ts'

export const useBoundStore = create<StoreState>()(
  devtools(
    immer((...a) => ({
      ...(createAuthSlice(...a) as unknown as StoreState),
    })),
    { name: 'My Financial Life' },
  ),
)
```

## Adding a New Slice

1. Create `store/slices/yourSlice.ts` using `namespaceSlice`
2. Export a `YourSlice` type and `createYourSlice` creator
3. Combine in `store/types.ts`: `export type StoreState = AuthSlice & YourSlice`
4. Add to `store/useBoundStore.ts`: `...(createYourSlice(...a) as unknown as StoreState),`

## Selectors

- Prefer individual selectors for single values: `useBoundStore((s) => s.auth.user)`
- Use `useShallow` for multi-value object selectors:
  ```ts
  const { user, token } = useBoundStore(
    useShallow((s) => ({ user: s.auth.user, token: s.auth.token })),
  )
  ```

## Gotcha: `get()` inside a slice only sees that slice's STATE, not its actions

`namespaceSlice`'s `get` parameter returns `state.<namespace>` — the state fields object
only. Actions are merged flat at the top level of the store, not under the namespace, so
`get().someActionInThisSameSlice()` is `undefined()` and throws — silently breaking any
`await` chain built on it (this shipped once: `login()` called `get().fetchCurrentUser()`,
which crashed after a successful login and the app never navigated away from `/login`).
**Fix**: call another action in the same slice by closing over `set`/logic directly (a
local helper function inside the slice creator), not by fetching it off `get()`.
`get()` is fine for reading this slice's *state* (e.g. `get().user` to read current value
before an optimistic update) — just not for calling sibling actions.

## Outside React (Interceptors, Helpers)

Use `useBoundStore.getState()` and `useBoundStore.setState()` for read/write outside React:

```ts
const { token } = useBoundStore.getState().auth
useBoundStore.setState((s) => ({ auth: { ...s.auth, token: newToken } }))
```

## What Not To Do

- Do NOT use TanStack Query / React Query — Zustand handles all data fetching
- Do NOT use React Context for global state — auth state lives in Zustand's `auth`
  slice like everything else, no separate Context wrapper
- Do NOT import slices directly from components — always go through `useBoundStore`
- Do NOT put API calls in components — all data fetching goes in slice actions
