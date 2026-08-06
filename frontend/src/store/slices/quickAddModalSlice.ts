import { namespaceSlice } from '../namespaceSlice.ts'

export interface QuickAddParsedResult {
  amount: number | null
  description: string
  type: string
  category: string | null
  merchant?: string | null
  missing?: string[]
}

export interface QuickAddModalState {
  input: string
  loading: boolean
  parsed: QuickAddParsedResult | null
  saving: boolean
  scanning: boolean
  selectedCategoryId: number | null
  // One-question rule (design-system.md §4): the single inline follow-up value when
  // /parse comes back with missing=["amount"] — never a second question on top of it.
  manualAmount: string
}

export interface QuickAddModalActions {
  setQuickAddInput: (input: string) => void
  setQuickAddLoading: (loading: boolean) => void
  setQuickAddParsed: (parsed: QuickAddParsedResult | null) => void
  setQuickAddSaving: (saving: boolean) => void
  setQuickAddScanning: (scanning: boolean) => void
  setQuickAddSelectedCategoryId: (id: number | null) => void
  setQuickAddManualAmount: (amount: string) => void
  resetQuickAddModal: () => void
}

export type QuickAddModalSlice = {
  quickAddModal: QuickAddModalState & QuickAddModalActions
}

const initialState: QuickAddModalState = {
  input: '',
  loading: false,
  parsed: null,
  saving: false,
  scanning: false,
  selectedCategoryId: null,
  manualAmount: '',
}

export const createQuickAddModalSlice = namespaceSlice('quickAddModal', (set) => ({
  ...initialState,

  setQuickAddInput: (input: string) => set({ input }),
  setQuickAddLoading: (loading: boolean) => set({ loading }),
  setQuickAddParsed: (parsed: QuickAddParsedResult | null) => set({ parsed }),
  setQuickAddSaving: (saving: boolean) => set({ saving }),
  setQuickAddScanning: (scanning: boolean) => set({ scanning }),
  setQuickAddSelectedCategoryId: (id: number | null) => set({ selectedCategoryId: id }),
  setQuickAddManualAmount: (amount: string) => set({ manualAmount: amount }),

  // Called on close/save so a half-filled entry never leaks into the next open —
  // same rule as registerFormSlice/loginFormSlice (rules/dry.md).
  resetQuickAddModal: () => set({ ...initialState }),
}))
