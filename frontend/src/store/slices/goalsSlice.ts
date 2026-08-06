import { namespaceSlice, isFresh, getErrorDetail, refetchCollection } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

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
    try {
      await api.post('/api/goals/', data)
      await refetchCollection<Goal[]>(set, '/api/goals/', 'items')
      toast.success('Goal created')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to create goal'))
      throw error
    }
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
    try {
      await api.put(`/api/goals/${id}`, data)
      await refetchCollection<Goal[]>(set, '/api/goals/', 'items')
      toast.success('Goal updated')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to update goal'))
      throw error
    }
  },

  contributeToGoal: async (goalId: number, amount: number) => {
    try {
      await api.post(`/api/goals/${goalId}/contribute`, { amount })
      await refetchCollection<Goal[]>(set, '/api/goals/', 'items')
      toast.success('Contribution added')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to contribute'))
      throw error
    }
  },

  deleteGoal: async (id: number) => {
    try {
      await api.delete(`/api/goals/${id}`)
      const items: Goal[] = get().items
      set({ items: items.filter((g) => g.id !== id) })
      toast.success('Goal deleted')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to delete goal'))
      throw error
    }
  },
}))

// --- Goals form/dialog state (merged from goalsFormSlice.ts) ---

export interface GoalCreateFormState {
  open: boolean
  name: string
  goalAmount: string
  goalType: string
  initialAmount: string
  saving: boolean
}

export interface GoalContributeFormState {
  open: boolean
  amount: string
  contributing: boolean
}

export interface GoalEditFormState {
  open: boolean
  name: string
  target: string
  current: string
  monthly: string
  deadline: string
  type: string
  saving: boolean
}

export interface GoalsFormState {
  create: GoalCreateFormState
  detailGoalId: number | null
  contribute: GoalContributeFormState
  edit: GoalEditFormState
}

export interface GoalsFormActions {
  setGoalCreateOpen: (open: boolean) => void
  setGoalCreateField: (
    field: keyof Omit<GoalCreateFormState, 'open' | 'saving'>,
    value: string,
  ) => void
  setGoalCreateSaving: (saving: boolean) => void
  resetGoalCreateForm: () => void

  openGoalDetail: (goalId: number) => void
  closeGoalDetail: () => void

  setGoalContributeOpen: (open: boolean) => void
  setGoalContributeAmount: (amount: string) => void
  setGoalContributing: (contributing: boolean) => void

  openGoalEdit: (goal: {
    name: string
    target_amount: number
    current_amount: number
    monthly_contribution: number | null
    deadline: string | null
    type: string
  }) => void
  setGoalEditOpen: (open: boolean) => void
  setGoalEditField: (field: keyof Omit<GoalEditFormState, 'open' | 'saving'>, value: string) => void
  setGoalEditSaving: (saving: boolean) => void
}

export type GoalsFormSlice = {
  goalsForm: GoalsFormState & GoalsFormActions
}

const createInitial = (): GoalCreateFormState => ({
  open: false,
  name: '',
  goalAmount: '',
  goalType: 'save_up',
  initialAmount: '',
  saving: false,
})

const contributeInitial = (): GoalContributeFormState => ({
  open: false,
  amount: '',
  contributing: false,
})

const editInitial = (): GoalEditFormState => ({
  open: false,
  name: '',
  target: '',
  current: '',
  monthly: '',
  deadline: '',
  type: 'save_up',
  saving: false,
})

const goalsFormInitialState: GoalsFormState = {
  create: createInitial(),
  detailGoalId: null,
  contribute: contributeInitial(),
  edit: editInitial(),
}

export const createGoalsFormSlice = namespaceSlice('goalsForm', (set, get) => ({
  ...goalsFormInitialState,

  setGoalCreateOpen: (open: boolean) => {
    set({ create: { ...(open ? createInitial() : get().create), open, saving: false } })
  },

  setGoalCreateField: (
    field: keyof Omit<GoalCreateFormState, 'open' | 'saving'>,
    value: string,
  ) => {
    set({ create: { ...get().create, [field]: value } })
  },

  setGoalCreateSaving: (saving: boolean) => {
    set({ create: { ...get().create, saving } })
  },

  resetGoalCreateForm: () => {
    set({ create: createInitial() })
  },

  openGoalDetail: (goalId: number) => {
    set({ detailGoalId: goalId })
  },

  closeGoalDetail: () => {
    set({
      detailGoalId: null,
      contribute: contributeInitial(),
      edit: editInitial(),
    })
  },

  setGoalContributeOpen: (open: boolean) => {
    set({ contribute: { ...contributeInitial(), open } })
  },

  setGoalContributeAmount: (amount: string) => {
    set({ contribute: { ...get().contribute, amount } })
  },

  setGoalContributing: (contributing: boolean) => {
    set({ contribute: { ...get().contribute, contributing } })
  },

  openGoalEdit: (goal: {
    name: string
    target_amount: number
    current_amount: number
    monthly_contribution: number | null
    deadline: string | null
    type: string
  }) => {
    set({
      edit: {
        open: true,
        name: goal.name,
        target: String(goal.target_amount),
        current: String(goal.current_amount),
        monthly: goal.monthly_contribution ? String(goal.monthly_contribution) : '',
        deadline: goal.deadline || '',
        type: goal.type,
        saving: false,
      },
    })
  },

  setGoalEditOpen: (open: boolean) => {
    set({ edit: { ...get().edit, open } })
  },

  setGoalEditField: (field: keyof Omit<GoalEditFormState, 'open' | 'saving'>, value: string) => {
    set({ edit: { ...get().edit, [field]: value } })
  },

  setGoalEditSaving: (saving: boolean) => {
    set({ edit: { ...get().edit, saving } })
  },
}))
