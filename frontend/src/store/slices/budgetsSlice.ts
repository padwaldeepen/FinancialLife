import { namespaceSlice, isFresh, getErrorDetail, refetchCollection } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

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
    lastFetchedAt: number | null
    fetchBudgets: (opts?: { force?: boolean }) => Promise<void>
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
}

export const createBudgetsSlice = namespaceSlice('budgets', (set, get) => ({
  items: [] as Budget[],
  loading: true,
  lastFetchedAt: null as number | null,

  fetchBudgets: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/budgets/')
      set({ items: res.data, lastFetchedAt: Date.now() })
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
    try {
      await api.post('/api/budgets/', data)
      await refetchCollection<Budget[]>(set, '/api/budgets/', 'items')
      toast.success('Budget created')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to save budget'))
      throw error
    }
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
    try {
      await api.put(`/api/budgets/${id}`, data)
      await refetchCollection<Budget[]>(set, '/api/budgets/', 'items')
      toast.success('Budget updated')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to save budget'))
      throw error
    }
  },

  deleteBudget: async (id: number) => {
    try {
      await api.delete(`/api/budgets/${id}`)
      const items: Budget[] = get().items
      set({ items: items.filter((b) => b.id !== id) })
      toast.success('Budget deleted')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to delete budget'))
      throw error
    }
  },
}))

// --- Budget form/dialog state (merged from budgetFormSlice.ts) ---

export interface BudgetFormState {
  dialogOpen: boolean
  budgetId: number | null
  name: string
  amount: string
  period: string
  saving: boolean
  deleteId: number | null
  deleting: boolean
}

export interface BudgetFormActions {
  openBudgetCreate: () => void
  openBudgetEdit: (budget: { id: number; name: string; amount: number; period: string }) => void
  setBudgetDialogOpen: (open: boolean) => void
  setBudgetName: (name: string) => void
  setBudgetAmount: (amount: string) => void
  setBudgetPeriod: (period: string) => void
  setBudgetSaving: (saving: boolean) => void
  startBudgetDelete: (id: number) => void
  cancelBudgetDelete: () => void
  setBudgetDeleting: (deleting: boolean) => void
}

export type BudgetFormSlice = {
  budgetForm: BudgetFormState & BudgetFormActions
}

const budgetFormInitialState: BudgetFormState = {
  dialogOpen: false,
  budgetId: null,
  name: '',
  amount: '',
  period: 'monthly',
  saving: false,
  deleteId: null,
  deleting: false,
}

export const createBudgetFormSlice = namespaceSlice('budgetForm', (set) => ({
  ...budgetFormInitialState,

  openBudgetCreate: () => {
    set({ budgetId: null, name: '', amount: '', period: 'monthly', dialogOpen: true })
  },

  openBudgetEdit: (budget: { id: number; name: string; amount: number; period: string }) => {
    set({
      budgetId: budget.id,
      name: budget.name,
      amount: String(budget.amount),
      period: budget.period,
      dialogOpen: true,
    })
  },

  setBudgetDialogOpen: (open: boolean) => set({ dialogOpen: open }),
  setBudgetName: (name: string) => set({ name }),
  setBudgetAmount: (amount: string) => set({ amount }),
  setBudgetPeriod: (period: string) => set({ period }),
  setBudgetSaving: (saving: boolean) => set({ saving }),
  startBudgetDelete: (id: number) => set({ deleteId: id }),
  cancelBudgetDelete: () => set({ deleteId: null }),
  setBudgetDeleting: (deleting: boolean) => set({ deleting }),
}))
