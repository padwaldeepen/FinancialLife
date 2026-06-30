import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'

interface Account {
  id: number
  name: string
  type: string
  currency: string
  balance: number
  is_active: boolean
}

export type AccountsSlice = {
  accounts: {
    items: Account[]
    loading: boolean
  }
  fetchAccounts: () => Promise<void>
}

export const createAccountsSlice = namespaceSlice('accounts', (set) => ({
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
}))
