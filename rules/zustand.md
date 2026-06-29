# Zustand Rules

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
    { name: 'FinanceFlare' },
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
