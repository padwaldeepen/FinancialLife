import toast from '../../shared/utils/toast.ts'
import { namespaceSlice, isFresh } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'

export interface Transaction {
  id: number
  amount: number
  description: string
  transaction_type: string
  account_id: number
  account_name: string | null
  category_id: number | null
  category_name: string | null
  category_color: string | null
  merchant_id: number | null
  merchant_name: string | null
  bill_id: number | null
  goal_id: number | null
  is_pending: boolean
  is_recurring: boolean
  date: string
  notes: string | null
  ai_categorized: boolean
  document_id: number | null
  created_at: string
}

interface FetchTxParams {
  reset?: boolean
  force?: boolean
  search?: string
  typeFilter?: string
  categoryFilter?: string
  merchantFilter?: string
  startDate?: string
  endDate?: string
}

export type TransactionsSlice = {
  transactions: {
    items: Transaction[]
    loading: boolean
    loadingMore: boolean
    hasMore: boolean
    lastFetchedAt: number | null
    fetchTransactions: (params?: FetchTxParams) => Promise<void>
    deleteTransaction: (id: number) => void
    updateNotes: (id: number, notes: string) => void
    updateTransaction: (
      id: number,
      data: Partial<Omit<Transaction, 'id' | 'created_at'>>,
    ) => Promise<void>
  }
}

const LIMIT = 50

export const createTransactionsSlice = namespaceSlice('transactions', (set, get) => ({
  items: [] as Transaction[],
  loading: true,
  loadingMore: false,
  hasMore: true,
  lastFetchedAt: null as number | null,

  fetchTransactions: async (params?: FetchTxParams) => {
    const reset = params?.reset ?? false
    // Staleness only applies to a plain "reload the default view" call (no search/
    // filter args) — a filtered fetch (Activity's search/category/date filters) must
    // always hit the network. Home's `fetchTransactions({ reset: true })` is the case
    // this skips.
    const isPlainReset =
      reset &&
      !params?.search &&
      !params?.typeFilter &&
      !params?.categoryFilter &&
      !params?.merchantFilter &&
      !params?.startDate &&
      !params?.endDate
    if (isPlainReset && !params?.force && isFresh(get().lastFetchedAt)) return

    if (reset) {
      set({ items: [], loading: true, hasMore: true })
    } else {
      set({ loadingMore: true })
    }

    try {
      const offset = reset ? 0 : get().items.length
      const queryParams: Record<string, string | number> = {
        skip: offset,
        limit: LIMIT,
        sort_by: 'date',
        sort_order: 'desc',
      }
      if (params?.search) queryParams.search = params.search
      if (params?.typeFilter) queryParams.transaction_type = params.typeFilter
      if (params?.categoryFilter) queryParams.category_id = Number(params.categoryFilter)
      if (params?.merchantFilter) queryParams.merchant_id = Number(params.merchantFilter)
      if (params?.startDate) queryParams.start_date = params.startDate
      if (params?.endDate) queryParams.end_date = params.endDate

      const res = await api.get('/api/transactions/', { params: queryParams })
      const data = res.data as Transaction[]
      if (reset) {
        set({ items: data, ...(isPlainReset ? { lastFetchedAt: Date.now() } : {}) })
      } else {
        set({ items: [...get().items, ...data] })
      }
      if (data.length < LIMIT) set({ hasMore: false })
    } catch {
      toast.error('Could not load transactions')
    } finally {
      set({ loading: false, loadingMore: false })
    }
  },

  deleteTransaction: (id: number) => {
    const items: Transaction[] = get().items
    const index = items.findIndex((t) => t.id === id)
    if (index === -1) return
    const tx = items[index]!
    set({ items: items.filter((t) => t.id !== id) })

    api.delete(`/api/transactions/${id}`).catch(() => {
      // Restore date-sorted (list is sorted desc by date), not at the captured
      // `index` — the array can have grown/shrunk (infinite scroll, another delete)
      // by the time this rollback runs, making that index stale.
      const current: Transaction[] = get().items
      const restoreAt = current.findIndex((t) => new Date(t.date) < new Date(tx.date))
      const restored = [...current]
      restored.splice(restoreAt === -1 ? current.length : restoreAt, 0, tx)
      set({ items: restored })
      toast.error('Failed to delete transaction')
    })
  },

  updateNotes: (id: number, notes: string) => {
    const items: Transaction[] = get().items
    const old = items.find((t) => t.id === id)
    set({ items: items.map((t) => (t.id === id ? { ...t, notes } : t)) })

    api
      .put(`/api/transactions/${id}`, { notes })
      .then(() => {
        toast.success('Notes updated')
      })
      .catch(() => {
        if (old) {
          const current: Transaction[] = get().items
          set({ items: current.map((t) => (t.id === id ? old : t)) })
        }
        toast.error('Failed to save notes')
      })
  },

  updateTransaction: async (id: number, data: Partial<Omit<Transaction, 'id' | 'created_at'>>) => {
    const items: Transaction[] = get().items
    const old = items.find((t) => t.id === id)
    set({ items: items.map((t) => (t.id === id ? { ...t, ...data } : t)) })

    try {
      await api.put(`/api/transactions/${id}`, data)
    } catch {
      if (old) {
        const current: Transaction[] = get().items
        set({ items: current.map((t) => (t.id === id ? old : t)) })
      }
      toast.error('Failed to update transaction')
      throw new Error('Failed to update transaction')
    }
  },
}))

// --- Transaction edit form state (merged from transactionEditFormSlice.ts) ---

export interface TransactionEditForm {
  amount: number
  description: string
  transaction_type: string
  category_id: number | null
  merchant_id: number | null
  account_id: number
  date: string
  is_pending: boolean
  is_recurring: boolean
}

export interface TransactionEditFormState {
  editing: boolean
  editNotes: string
  linkBillOpen: boolean
  linkBillSearch: string
  editForm: TransactionEditForm
}

export interface TransactionEditFormActions {
  initTransactionEditForm: (transaction: {
    notes: string | null
    amount: number
    description: string
    transaction_type: string
    category_id: number | null
    merchant_id: number | null
    account_id: number
    date: string
    is_pending: boolean
    is_recurring: boolean
  }) => void
  setTransactionEditing: (editing: boolean) => void
  setTransactionEditNotes: (notes: string) => void
  setTransactionLinkBillOpen: (open: boolean) => void
  setTransactionLinkBillSearch: (search: string) => void
  setTransactionEditFormField: <K extends keyof TransactionEditForm>(
    field: K,
    value: TransactionEditForm[K],
  ) => void
  // W4: pre-highlight a category suggestion when editing an uncategorized transaction —
  // still fully editable via the existing Select, this only fills a blank. Takes the
  // caller's already-fetched flat category list (id/name) to resolve the suggested name
  // to an id — namespaceSlice's `get()` only sees this slice's own state, not
  // categoriesSlice's, so the list can't be read cross-slice from in here.
  suggestTransactionCategory: (
    description: string,
    transactionType: string,
    categories: { id: number; name: string }[],
  ) => Promise<void>
}

export type TransactionEditFormSlice = {
  transactionEditForm: TransactionEditFormState & TransactionEditFormActions
}

const emptyEditForm = (): TransactionEditForm => ({
  amount: 0,
  description: '',
  transaction_type: 'expense',
  category_id: null,
  merchant_id: null,
  account_id: 0,
  date: '',
  is_pending: false,
  is_recurring: false,
})

const transactionEditFormInitialState: TransactionEditFormState = {
  editing: false,
  editNotes: '',
  linkBillOpen: false,
  linkBillSearch: '',
  editForm: emptyEditForm(),
}

export const createTransactionEditFormSlice = namespaceSlice('transactionEditForm', (set, get) => ({
  ...transactionEditFormInitialState,

  initTransactionEditForm: (transaction: {
    notes: string | null
    amount: number
    description: string
    transaction_type: string
    category_id: number | null
    merchant_id: number | null
    account_id: number
    date: string
    is_pending: boolean
    is_recurring: boolean
  }) => {
    set({
      editing: false,
      editNotes: transaction.notes || '',
      linkBillOpen: false,
      linkBillSearch: '',
      editForm: {
        amount: transaction.amount,
        description: transaction.description,
        transaction_type: transaction.transaction_type,
        category_id: transaction.category_id,
        merchant_id: transaction.merchant_id,
        account_id: transaction.account_id,
        date: transaction.date,
        is_pending: transaction.is_pending,
        is_recurring: transaction.is_recurring,
      },
    })
  },

  setTransactionEditing: (editing: boolean) => set({ editing }),
  setTransactionEditNotes: (notes: string) => set({ editNotes: notes }),
  setTransactionLinkBillOpen: (open: boolean) => set({ linkBillOpen: open }),
  setTransactionLinkBillSearch: (search: string) => set({ linkBillSearch: search }),

  setTransactionEditFormField: <K extends keyof TransactionEditForm>(
    field: K,
    value: TransactionEditForm[K],
  ) => {
    set({ editForm: { ...get().editForm, [field]: value } })
  },

  suggestTransactionCategory: async (
    description: string,
    transactionType: string,
    categories: { id: number; name: string }[],
  ) => {
    if (get().editForm.category_id !== null) return
    try {
      const res = await api.get('/api/categories/suggest', {
        params: { description, transaction_type: transactionType },
      })
      const suggestedName = (res.data as { category: string | null }).category
      if (!suggestedName || get().editForm.category_id !== null) return
      const match = categories.find((c) => c.name.toLowerCase() === suggestedName.toLowerCase())
      if (match) set({ editForm: { ...get().editForm, category_id: match.id } })
    } catch {
      // best-effort suggestion — leave the Select on "None" if it fails
    }
  },
}))

// --- Activity page state (merged from activityPageSlice.ts) ---

export interface ActivityPageState {
  selectedId: number | null
  selectMode: boolean
  documentUploadOpen: boolean
  viewingDocumentId: number | null
  selectedIds: Set<number>
  bulkCategory: string
  bulkAccount: string
  bulkApplying: boolean
  // Mobile Activity page (separate component tree from desktop's above — merged
  // from useState per rules/zustand.md). Kept as sibling fields rather than reusing
  // the desktop ones above since mobile's swipe-to-delete/filter-toggle/notes-edit
  // UX has no desktop equivalent.
  mobileShowFilters: boolean
  mobileSwipedId: number | null
  mobileSelectedId: number | null
  mobileEditNotes: string
}

export interface ActivityPageActions {
  setActivitySelectedId: (id: number | null) => void
  toggleActivitySelectMode: () => void
  toggleActivitySelected: (id: number) => void
  setActivityDocumentUploadOpen: (open: boolean) => void
  setActivityViewingDocumentId: (id: number | null) => void
  setActivityBulkCategory: (category: string) => void
  setActivityBulkAccount: (account: string) => void
  setActivityBulkApplying: (applying: boolean) => void
  resetActivityBulkEdit: () => void
  setMobileActivityShowFilters: (show: boolean) => void
  setMobileActivitySwipedId: (id: number | null) => void
  openMobileActivityDetail: (transaction: { id: number; notes: string | null }) => void
  closeMobileActivityDetail: () => void
  setMobileActivityEditNotes: (notes: string) => void
}

export type ActivityPageSlice = {
  activityPage: ActivityPageState & ActivityPageActions
}

const activityPageInitialState: ActivityPageState = {
  selectedId: null,
  selectMode: false,
  documentUploadOpen: false,
  viewingDocumentId: null,
  selectedIds: new Set<number>(),
  bulkCategory: '',
  bulkAccount: '',
  bulkApplying: false,
  mobileShowFilters: false,
  mobileSwipedId: null,
  mobileSelectedId: null,
  mobileEditNotes: '',
}

export const createActivityPageSlice = namespaceSlice('activityPage', (set, get) => ({
  ...activityPageInitialState,

  setActivitySelectedId: (id: number | null) => set({ selectedId: id }),

  toggleActivitySelectMode: () => {
    set({ selectMode: !get().selectMode, selectedIds: new Set<number>() })
  },

  toggleActivitySelected: (id: number) => {
    const next = new Set(get().selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    set({ selectedIds: next })
  },

  setActivityDocumentUploadOpen: (open: boolean) => set({ documentUploadOpen: open }),
  setActivityViewingDocumentId: (id: number | null) => set({ viewingDocumentId: id }),
  setActivityBulkCategory: (category: string) => set({ bulkCategory: category }),
  setActivityBulkAccount: (account: string) => set({ bulkAccount: account }),
  setActivityBulkApplying: (applying: boolean) => set({ bulkApplying: applying }),

  resetActivityBulkEdit: () => {
    set({
      selectedIds: new Set<number>(),
      selectMode: false,
      bulkCategory: '',
      bulkAccount: '',
      bulkApplying: false,
    })
  },

  setMobileActivityShowFilters: (show: boolean) => set({ mobileShowFilters: show }),
  setMobileActivitySwipedId: (id: number | null) => set({ mobileSwipedId: id }),

  openMobileActivityDetail: (transaction: { id: number; notes: string | null }) => {
    set({ mobileSelectedId: transaction.id, mobileEditNotes: transaction.notes || '' })
  },
  closeMobileActivityDetail: () => set({ mobileSelectedId: null }),
  setMobileActivityEditNotes: (notes: string) => set({ mobileEditNotes: notes }),
}))
