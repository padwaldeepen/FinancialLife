import { namespaceSlice, getErrorDetail } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'
import { refreshAfterMoneyChange } from '../refreshAfterMoneyChange.ts'
import { useBoundStore } from '../useBoundStore.ts'

export interface QuickAddParsedResult {
  amount: number | null
  description: string
  type: string
  category: string | null
  merchant?: string | null
  // Y6: the backend's ParseResponse has always returned this (it's how "coffee 4.50
  // yesterday" resolves to an absolute date), but the client type omitted it, so the
  // one field the user couldn't otherwise verify was silently dropped before reaching
  // the confirmation card.
  date?: string | null
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
  // Drag-over visual state for the drop target — same purpose as
  // documentUploadDialog's dragActive, mirrored here since this modal's drop handler
  // previously had no visual feedback at all (silently accepted a drop anywhere on
  // the dialog with nothing telling the user it was droppable).
  dragActive: boolean
}

export interface QuickAddModalActions {
  // R5: the behaviour, not just the state. Both trees ran byte-identical copies of
  // these two (parse → confirm → save → refresh), so a fix to either had to be made
  // twice and in practice drifted. rules/zustand.md also bans api calls in components.
  parseQuickAdd: () => Promise<void>
  saveQuickAdd: () => Promise<void>
  setQuickAddInput: (input: string) => void
  setQuickAddParsed: (parsed: QuickAddParsedResult | null) => void
  setQuickAddScanning: (scanning: boolean) => void
  setQuickAddSelectedCategoryId: (id: number | null) => void
  setQuickAddManualAmount: (amount: string) => void
  setQuickAddDragActive: (dragActive: boolean) => void
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
  dragActive: false,
}

export const createQuickAddModalSlice = namespaceSlice('quickAddModal', (set, get) => ({
  ...initialState,

  parseQuickAdd: async () => {
    const { input } = get()
    if (!input.trim()) return
    set({ loading: true })
    try {
      const res = await api.post('/api/transactions/parse', { text: input })
      set({ parsed: res.data as QuickAddParsedResult })
    } catch (error) {
      toast.error(getErrorDetail(error, 'Could not parse that text'))
    } finally {
      set({ loading: false })
    }
  },

  saveQuickAdd: async () => {
    const { input, parsed, selectedCategoryId, manualAmount } = get()
    if (!parsed) return
    const amountMissing = parsed.missing?.includes('amount') ?? false
    if (amountMissing && !manualAmount) return
    set({ saving: true })
    try {
      await api.post('/api/transactions/quick-add', {
        text: input,
        category_id: selectedCategoryId ?? undefined,
        amount: amountMissing ? parseFloat(manualAmount) : undefined,
      })
      toast.success('Transaction added!')
      set({ ...initialState })
      useBoundStore.getState().ui.closeAddModal()
      refreshAfterMoneyChange()
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to save transaction'))
    } finally {
      set({ saving: false })
    }
  },

  setQuickAddInput: (input: string) => set({ input }),
  setQuickAddParsed: (parsed: QuickAddParsedResult | null) => set({ parsed }),
  setQuickAddScanning: (scanning: boolean) => set({ scanning }),
  setQuickAddSelectedCategoryId: (id: number | null) => set({ selectedCategoryId: id }),
  setQuickAddManualAmount: (amount: string) => set({ manualAmount: amount }),
  setQuickAddDragActive: (dragActive: boolean) => set({ dragActive }),

  // Called on close/save so a half-filled entry never leaks into the next open —
  // same rule as registerFormSlice/loginFormSlice (rules/dry.md).
  resetQuickAddModal: () => set({ ...initialState }),
}))
