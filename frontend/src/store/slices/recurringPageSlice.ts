import { namespaceSlice } from '../namespaceSlice.ts'
import type { Bill } from './billsSlice.ts'
import type { Budget } from './budgetsSlice.ts'

// Recurring.tsx's bill-dialog and budget-dialog UI state — was 12 separate useState
// calls in the component (rules/zustand.md: "if a component holds more than one
// piece of state, it goes in Zustand — not useState"). Reset on mount (see
// Recurring.tsx) so state left over from a previous visit never leaks into a fresh
// one, the same rule registerFormSlice/loginFormSlice/quickAddModalSlice follow.
export interface RecurringPageState {
  budgetDialogOpen: boolean
  editingBudget: Budget | null
  budgetName: string
  budgetAmount: string
  budgetPeriod: string
  budgetSaving: boolean
  budgetDeleteId: number | null
  budgetDeleting: boolean
  formOpen: boolean
  editingBill: Bill | null
  selectedBill: Bill | null
  saving: boolean
}

export interface RecurringPageActions {
  setBudgetDialogOpen: (open: boolean) => void
  setEditingBudget: (budget: Budget | null) => void
  setBudgetName: (name: string) => void
  setBudgetAmount: (amount: string) => void
  setBudgetPeriod: (period: string) => void
  setBudgetSaving: (saving: boolean) => void
  setBudgetDeleteId: (id: number | null) => void
  setBudgetDeleting: (deleting: boolean) => void
  setFormOpen: (open: boolean) => void
  setEditingBill: (bill: Bill | null) => void
  setSelectedBill: (bill: Bill | null) => void
  setSaving: (saving: boolean) => void
  resetRecurringPage: () => void
}

export type RecurringPageSlice = {
  recurringPage: RecurringPageState & RecurringPageActions
}

const initialState: RecurringPageState = {
  budgetDialogOpen: false,
  editingBudget: null,
  budgetName: '',
  budgetAmount: '',
  budgetPeriod: 'monthly',
  budgetSaving: false,
  budgetDeleteId: null,
  budgetDeleting: false,
  formOpen: false,
  editingBill: null,
  selectedBill: null,
  saving: false,
}

export const createRecurringPageSlice = namespaceSlice('recurringPage', (set) => ({
  ...initialState,

  setBudgetDialogOpen: (open: boolean) => set({ budgetDialogOpen: open }),
  setEditingBudget: (budget: Budget | null) => set({ editingBudget: budget }),
  setBudgetName: (name: string) => set({ budgetName: name }),
  setBudgetAmount: (amount: string) => set({ budgetAmount: amount }),
  setBudgetPeriod: (period: string) => set({ budgetPeriod: period }),
  setBudgetSaving: (saving: boolean) => set({ budgetSaving: saving }),
  setBudgetDeleteId: (id: number | null) => set({ budgetDeleteId: id }),
  setBudgetDeleting: (deleting: boolean) => set({ budgetDeleting: deleting }),
  setFormOpen: (open: boolean) => set({ formOpen: open }),
  setEditingBill: (bill: Bill | null) => set({ editingBill: bill }),
  setSelectedBill: (bill: Bill | null) => set({ selectedBill: bill }),
  setSaving: (saving: boolean) => set({ saving }),

  resetRecurringPage: () => set({ ...initialState }),
}))
