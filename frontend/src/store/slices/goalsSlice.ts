import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'

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
  }
  fetchGoals: () => Promise<void>
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
  contributeToGoal: (goalId: number, amount: number) => Promise<void>
  deleteGoal: (id: number) => Promise<void>
}

export const createGoalsSlice = namespaceSlice('goals', (set, get) => ({
  items: [] as Goal[],
  loading: true,

  fetchGoals: async () => {
    set({ loading: true })
    try {
      const res = await api.get('/api/goals/')
      set({ items: res.data })
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
