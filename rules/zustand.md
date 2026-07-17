# Zustand Rules

## When state goes in Zustand vs `useState`

**The trigger is ownership, not count.** A component with five `useState` calls for a
form's fields is correct if that data is transient and local until submit — nobody else
needs it, and it doesn't survive the component unmounting. A component with exactly one
`useState` for data that's shared across components or persisted on the server is wrong.

- **Zustand**: state that (a) more than one component reads/writes, (b) is fetched from
  or persisted to the API, or (c) must survive navigation/unmount. Example: a user
  setting like `ai_cloud_enabled` — it's server-owned, shown in both desktop and mobile
  Settings, and other code (AI call sites) may need to read it later. This was fixed
  2026-07-17: the AI toggle originally lived as local `useState` + its own `useEffect`
  fetch duplicated in both Settings.tsx files — moved into `authSlice` (`user.ai_cloud_enabled`
  + `updateAiCloudEnabled` action) so there's one fetch, one source of truth, both trees
  read the same field.
- **`useState`**: transient, single-component, form-local values — dialog open/closed,
  in-progress form fields before submit, a `saving` spinner flag. Multiple `useState`
  calls in one component are fine when every one of them is local by this test.

If unsure, ask: "if the user opens this same data in the other device tree (desktop vs
mobile) or navigates away and back, should it be there already?" Yes → Zustand.

## Store Architecture

- Single bound store at `store/useBoundStore.ts` combining all slices
- Each domain gets a slice file in `store/slices/` (e.g. `authSlice.ts`)
- `useBoundStore` is the only store import — never import slices directly

## Creating a Slice

Use `namespaceSlice` helper from `store/namespaceSlice.ts`. It auto-namespaces state fields under a key while keeping action functions flat.

```ts
// store/slices/authSlice.ts
import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'

export type AuthSlice = {
  auth: AuthState
} & AuthActions

export const createAuthSlice = namespaceSlice('auth', (set, get) => ({
  // State — goes under s.auth.*
  user: null as User | null,
  token: null as string | null,
  loading: true,

  // Actions — stay flat at top level
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
- Do NOT use React Context for global state (AuthContext is the one exception and it wraps Zustand)
- Do NOT import slices directly from components — always go through `useBoundStore`
- Do NOT put API calls in components — all data fetching goes in slice actions
