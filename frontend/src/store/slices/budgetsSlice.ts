import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'

export interface Budget {
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
  createBudget: (data: {
    name: string
    amount: number
    period: string
    category_id?: number | null
  }) => Promise<void>
  updateBudget: (
    id: number,
    data: {
      name?: string
      amount?: number
      period?: string
      category_id?: number | null
      is_active?: boolean
    },
  ) => Promise<void>
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

  createBudget: async (data: {
    name: string
    amount: number
    period: string
    category_id?: number | null
  }) => {
    await api.post('/api/budgets/', data)
    const res = await api.get('/api/budgets/')
    set({ items: res.data })
  },

  updateBudget: async (
    id: number,
    data: {
      name?: string
      amount?: number
      period?: string
      category_id?: number | null
      is_active?: boolean
    },
  ) => {
    await api.put(`/api/budgets/${id}`, data)
    const res = await api.get('/api/budgets/')
    set({ items: res.data })
  },

  deleteBudget: async (id: number) => {
    await api.delete(`/api/budgets/${id}`)
    const items: Budget[] = get().items
    set({ items: items.filter((b) => b.id !== id) })
  },
}))
