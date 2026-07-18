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
  }
  fetchTransactions: (params?: FetchTxParams) => Promise<void>
  deleteTransaction: (id: number) => void
  updateNotes: (id: number, notes: string) => void
  updateTransaction: (
    id: number,
    data: Partial<Omit<Transaction, 'id' | 'created_at'>>,
  ) => Promise<void>
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
      // Restore at its original sort position, not appended to the end — the list is
      // date-sorted, and re-adding at the tail would misplace it visually.
      const current: Transaction[] = get().items
      const restored = [...current]
      restored.splice(index, 0, tx)
      set({ items: restored })
      toast.error('Failed to delete transaction')
    })
  },

  updateNotes: (id: number, notes: string) => {
    const items: Transaction[] = get().items
    const old = items.find((t) => t.id === id)
    set({ items: items.map((t) => (t.id === id ? { ...t, notes } : t)) })

    api.put(`/api/transactions/${id}`, { notes }).catch(() => {
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
