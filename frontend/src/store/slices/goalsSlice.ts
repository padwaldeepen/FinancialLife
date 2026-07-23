import { namespaceSlice, isFresh } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'

interface Goal {
  id: number
  name: string
  target_amount: number
  current_amount: number
  monthly_contribution: number | null
  type: string
  category_id: number | null
  category_name: string | null
  deadline: string | null
  icon: string | null
  color: string | null
  is_active: boolean
  sort_order: number
  progress_pct: number
  created_at: string
}

export type GoalsSlice = {
  goals: {
    items: Goal[]
    loading: boolean
    lastFetchedAt: number | null
  }
  fetchGoals: (opts?: { force?: boolean }) => Promise<void>
  createGoal: (data: {
    name: string
    target_amount: number
    type: string
    current_amount?: number
    monthly_contribution?: number | null
    category_id?: number | null
    deadline?: string | null
    icon?: string | null
    color?: string | null
  }) => Promise<void>
  updateGoal: (
    id: number,
    data: {
      name?: string
      target_amount?: number
      current_amount?: number
      monthly_contribution?: number | null
      type?: string
      category_id?: number | null
      deadline?: string | null
      icon?: string | null
      color?: string | null
      is_active?: boolean
    },
  ) => Promise<void>
  contributeToGoal: (goalId: number, amount: number) => Promise<void>
  deleteGoal: (id: number) => Promise<void>
}

export const createGoalsSlice = namespaceSlice('goals', (set, get) => ({
  items: [] as Goal[],
  loading: true,
  lastFetchedAt: null as number | null,

  fetchGoals: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/goals/')
      set({ items: res.data, lastFetchedAt: Date.now() })
    } finally {
      set({ loading: false })
    }
  },

  createGoal: async (data: {
    name: string
    target_amount: number
    type: string
    current_amount?: number
    monthly_contribution?: number | null
    category_id?: number | null
    deadline?: string | null
    icon?: string | null
    color?: string | null
  }) => {
    await api.post('/api/goals/', data)
    const res = await api.get('/api/goals/')
    set({ items: res.data })
  },

  updateGoal: async (
    id: number,
    data: {
      name?: string
      target_amount?: number
      current_amount?: number
      monthly_contribution?: number | null
      type?: string
      category_id?: number | null
      deadline?: string | null
      icon?: string | null
      color?: string | null
      is_active?: boolean
    },
  ) => {
    await api.put(`/api/goals/${id}`, data)
    const res = await api.get('/api/goals/')
    set({ items: res.data })
  },

  contributeToGoal: async (goalId: number, amount: number) => {
    await api.post(`/api/goals/${goalId}/contribute`, { amount })
    const res = await api.get('/api/goals/')
    set({ items: res.data })
  },

  deleteGoal: async (id: number) => {
    await api.delete(`/api/goals/${id}`)
    const items: Goal[] = get().items
    set({ items: items.filter((g) => g.id !== id) })
  },
}))
