# Zustand Rules

## Store Architecture
- Use the **slices pattern**: each domain has its own slice file in `store/slices/`
- Combine all slices into a **single bound store** in `store/index.ts`
- Never use separate standalone stores — always go through the bound store

```
store/
├── index.ts              # create bound store from all slices
├── slices/
│   ├── authSlice.ts      # Auth state + actions (login, register, logout, verifyToken)
│   ├── transactionSlice.ts  # Transaction CRUD + list state
│   ├── budgetSlice.ts    # Budget state + actions
│   └── uiSlice.ts        # UI preferences (sidebar, theme, etc.)
└── types.ts              # Shared store types
```

## Slices Pattern (TypeScript)

### Slice signature
```ts
import { type StateCreator } from 'zustand'
import type { StoreState } from '../types.ts'

export interface AuthSlice {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
  verifyToken: () => Promise<void>
}

export const createAuthSlice: StateCreator<StoreState, [], [], AuthSlice> = (set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  // actions...
})
```

### Bound store (combine slices)
```ts
import { create } from 'zustand'
import { createAuthSlice } from './slices/authSlice.ts'
import { createUiSlice } from './slices/uiSlice.ts'
import type { StoreState } from './types.ts'

export const useBoundStore = create<StoreState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createUiSlice(...a),
}))
```

### Types file
```ts
import type { AuthSlice } from './slices/authSlice.ts'
import type { UiSlice } from './slices/uiSlice.ts'

export type StoreState = AuthSlice & UiSlice
```

## Naming Conventions
- Slice files: `camelCaseSlice.ts` (`authSlice.ts`, `transactionSlice.ts`)
- Slice interfaces: `PascalCaseSlice` (`AuthSlice`, `TransactionSlice`)
- Bound store hook: `useBoundStore` (always default export from `store/index.ts`)
- Selectors in components: inline lambdas only — `useBoundStore((s) => s.user)`
- Actions: verbs in present tense (`login`, `fetchTransactions`, `deleteBudget`)

## State vs Actions
- State is plain data: `user`, `token`, `transactions`, `loading`
- Actions are functions that modify state: `login`, `logout`, `setTransactions`
- Keep state and actions in the same slice file (co-located by domain)
- API calls go inside action functions using `api` from `utils/api.ts`
- Never use `react-query` or TanStack Query — all data fetching via Zustand actions + axios

## Rules
- Every store update goes through `set()` — no external mutations
- Async actions use `async/await` with try/catch
- Always call services (`services/`) or `api` directly from slice actions
- Never import a slice file directly in a component — always use `useBoundStore`
- Only the slice creator function and the bound store should know about slices
- Middleware (persist, devtools) only in the bound store, never in individual slices
