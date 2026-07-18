import { namespaceSlice, isFresh } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'

export interface Account {
  id: number
  name: string
  type: string
  currency: string
  balance: number
  is_active: boolean
  sort_order: number
}

export type AccountsSlice = {
  accounts: {
    items: Account[]
    loading: boolean
    lastFetchedAt: number | null
  }
  fetchAccounts: (opts?: { force?: boolean }) => Promise<void>
  createAccount: (data: { name: string; type: string; currency?: string }) => Promise<Account>
  updateAccount: (
    id: number,
    data: { name?: string; type?: string; currency?: string; is_active?: boolean },
  ) => Promise<void>
  deleteAccount: (id: number) => Promise<void>
}

export const createAccountsSlice = namespaceSlice('accounts', (set, get) => ({
  items: [] as Account[],
  loading: true,
  lastFetchedAt: null as number | null,

  fetchAccounts: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/accounts/')
      set({ items: res.data, lastFetchedAt: Date.now() })
    } finally {
      set({ loading: false })
    }
  },

  createAccount: async (data: { name: string; type: string; currency?: string }) => {
    const res = await api.post('/api/accounts/', data)
    const account = res.data as Account
    const items: Account[] = get().items
    set({ items: [...items, account] })
    return account
  },

  updateAccount: async (
    id: number,
    data: { name?: string; type?: string; currency?: string; is_active?: boolean },
  ) => {
    const res = await api.put(`/api/accounts/${id}`, data)
    const updated = res.data as Account
    const items: Account[] = get().items
    set({ items: items.map((a) => (a.id === id ? updated : a)) })
  },

  deleteAccount: async (id: number) => {
    const items: Account[] = get().items
    set({ items: items.filter((a) => a.id !== id) })
    try {
      await api.delete(`/api/accounts/${id}`)
    } catch {
      set({ items })
    }
  },
}))
