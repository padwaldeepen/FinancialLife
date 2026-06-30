import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'

interface Account {
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
  }
  fetchAccounts: () => Promise<void>
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

  fetchAccounts: async () => {
    set({ loading: true })
    try {
      const res = await api.get('/api/accounts/')
      set({ items: res.data })
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
