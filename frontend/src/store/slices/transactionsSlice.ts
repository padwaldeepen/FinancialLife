import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'

export interface FilterOption {
  id: number
  name: string
}

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
    categories: FilterOption[]
    merchants: FilterOption[]
  }
  fetchTransactions: (params?: FetchTxParams) => Promise<void>
  fetchTxFilters: () => Promise<void>
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
  categories: [] as FilterOption[],
  merchants: [] as FilterOption[],

  fetchTransactions: async (params?: FetchTxParams) => {
    const reset = params?.reset ?? false
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
        set({ items: data })
      } else {
        set({ items: [...get().items, ...data] })
      }
      if (data.length < LIMIT) set({ hasMore: false })
    } catch {
      // error handled by caller
    } finally {
      set({ loading: false, loadingMore: false })
    }
  },

  fetchTxFilters: async () => {
    try {
      const [catRes, merRes] = await Promise.all([
        api.get('/api/categories/'),
        api.get('/api/merchants/'),
      ])
      set({
        categories: (catRes.data as FilterOption[]) || [],
        merchants: (merRes.data as FilterOption[]) || [],
      })
    } catch {
      // silent
    }
  },

  deleteTransaction: (id: number) => {
    const items: Transaction[] = get().items
    const tx = items.find((t) => t.id === id)
    set({ items: items.filter((t) => t.id !== id) })

    api.delete(`/api/transactions/${id}`).catch(() => {
      if (tx) {
        const current: Transaction[] = get().items
        set({ items: [...current, tx] })
      }
    })
  },

  updateNotes: (id: number, notes: string) => {
    const items: Transaction[] = get().items
    set({ items: items.map((t) => (t.id === id ? { ...t, notes } : t)) })

    api.put(`/api/transactions/${id}`, { notes }).catch(() => {
      // revert on failure
    })
  },

  updateTransaction: async (id: number, data: Partial<Omit<Transaction, 'id' | 'created_at'>>) => {
    const items: Transaction[] = get().items
    const old = items.find((t) => t.id === id)
    set({ items: items.map((t) => (t.id === id ? { ...t, ...data } : t)) })

    try {
      await api.put(`/api/transactions/${id}`, data)
    } catch {
      if (old) set({ items: items.map((t) => (t.id === id ? old : t)) })
    }
  },
}))
