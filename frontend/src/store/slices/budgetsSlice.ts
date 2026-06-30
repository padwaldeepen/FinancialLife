import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'

interface Budget {
  id: number
  name: string
  amount: number
  period: string
  category_id: number | null
  category_name: string | null
  category_color: string | null
  spent: number
  is_active: boolean
}

export type BudgetsSlice = {
  budgets: {
    items: Budget[]
    loading: boolean
  }
  fetchBudgets: () => Promise<void>
  createBudget: (data: { name: string; amount: number; period: string }) => Promise<void>
  deleteBudget: (id: number) => Promise<void>
}

export const createBudgetsSlice = namespaceSlice('budgets', (set, get) => ({
  items: [] as Budget[],
  loading: true,

  fetchBudgets: async () => {
    set({ loading: true })
    try {
      const res = await api.get('/api/budgets/')
      set({ items: res.data })
    } finally {
      set({ loading: false })
    }
  },

  createBudget: async (data: { name: string; amount: number; period: string }) => {
    await api.post('/api/budgets/', data)
    const res = await api.get('/api/budgets/')
    set({ items: res.data })
  },

  deleteBudget: async (id: number) => {
    await api.delete(`/api/budgets/${id}`)
    const items: Budget[] = get().items
    set({ items: items.filter((b) => b.id !== id) })
  },
}))
