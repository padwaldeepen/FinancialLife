import { namespaceSlice, isFresh, getErrorDetail, refetchCollection } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

interface Merchant {
  id: number
  name: string
  normalized_name: string
  aliases: string[] | null
  is_hidden: boolean
  transaction_count: number
  total_spent: number
  // Y7: the category the user taught us for this merchant. Null means nothing learned
  // yet and categorisation falls back to the keyword table.
  default_category_id: number | null
  default_category_name: string | null
}

interface DetailData {
  id: number
  name: string
  is_hidden: boolean
  total_spent: number
  total_income: number
  transaction_count: number
  first_transaction_date: string | null
  last_transaction_date: string | null
  category_breakdown: { category_name: string; color: string; total: number; count: number }[]
  monthly_spending: { month: string; amount: number }[]
  recent_transactions: {
    id: number
    amount: number
    description: string
    transaction_type: string
    date: string
    category_name: string | null
    category_color: string | null
  }[]
}

interface SimilarPair {
  merchant_a: { id: number; name: string; total_spent: number }
  merchant_b: { id: number; name: string; total_spent: number }
  similarity: number
}

export type MerchantsSlice = {
  merchants: {
    items: Merchant[]
    loading: boolean
    detail: DetailData | null
    similarPairs: SimilarPair[]
    lastFetchedAt: number | null
    fetchMerchants: (opts?: { force?: boolean }) => Promise<void>
    fetchMerchantDetail: (id: number) => Promise<void>
    toggleHidden: (id: number, current: boolean) => Promise<void>
    updateMerchant: (id: number, data: { name?: string; is_hidden?: boolean }) => Promise<void>
    deleteMerchant: (id: number) => Promise<void>
    // Y7: forget the learned category. A dedicated call rather than updateMerchant with
    // null, because the backend's MerchantUpdate drops nulls and couldn't express it.
    clearMerchantDefaultCategory: (id: number) => Promise<void>
    fetchSimilar: () => Promise<void>
    doMerge: (targetId: number, sourceId: number) => Promise<void>
  }
}

export const createMerchantsSlice = namespaceSlice('merchants', (set, get) => ({
  items: [] as Merchant[],
  loading: true,
  detail: null as DetailData | null,
  similarPairs: [] as SimilarPair[],
  lastFetchedAt: null as number | null,

  fetchMerchants: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/merchants/')
      set({ items: res.data, lastFetchedAt: Date.now() })
    } finally {
      set({ loading: false })
    }
  },

  fetchMerchantDetail: async (id: number) => {
    try {
      const res = await api.get(`/api/merchants/${id}`)
      set({ detail: res.data })
    } catch {
      toast.error('Failed to load merchant details')
    }
  },

  toggleHidden: async (id: number, current: boolean) => {
    try {
      await api.put(`/api/merchants/${id}`, { is_hidden: !current })
      await refetchCollection<Merchant[]>(set, '/api/merchants/', 'items')
      toast.success(current ? 'Merchant unhidden' : 'Merchant hidden')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to update merchant'))
      throw error
    }
  },

  updateMerchant: async (id: number, data: { name?: string; is_hidden?: boolean }) => {
    try {
      await api.put(`/api/merchants/${id}`, data)
      await refetchCollection<Merchant[]>(set, '/api/merchants/', 'items')
      toast.success('Merchant renamed')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to rename merchant'))
      throw error
    }
  },

  clearMerchantDefaultCategory: async (id: number) => {
    try {
      await api.delete(`/api/merchants/${id}/default-category`)
      await refetchCollection<Merchant[]>(set, '/api/merchants/', 'items')
      toast.success('Category rule cleared')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to clear the category rule'))
      throw error
    }
  },

  deleteMerchant: async (id: number) => {
    try {
      await api.delete(`/api/merchants/${id}`)
      await refetchCollection<Merchant[]>(set, '/api/merchants/', 'items')
      toast.success('Merchant deleted')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to delete merchant'))
      throw error
    }
  },

  fetchSimilar: async () => {
    try {
      const res = await api.get('/api/merchants/similar/')
      set({ similarPairs: res.data })
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to find similar merchants'))
      throw error
    }
  },

  doMerge: async (targetId: number, sourceId: number) => {
    try {
      await api.post('/api/merchants/merge', { target_id: targetId, source_ids: [sourceId] })
      await refetchCollection<Merchant[]>(set, '/api/merchants/', 'items', (data) => ({
        items: data,
        similarPairs: [],
      }))
      toast.success('Merchants merged')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to merge merchants'))
      throw error
    }
  },
}))

// --- Merchants page state (merged from merchantsPageSlice.ts) ---

export type MerchantSortBy = 'spent' | 'count' | 'name'

export interface MerchantsPageState {
  search: string
  selected: number | null
  sortBy: MerchantSortBy
  mergeDialogOpen: boolean
  renameOpen: boolean
  renameName: string
  renaming: boolean
  deleteConfirmId: number | null
  deleting: boolean
}

export interface MerchantsPageActions {
  setMerchantSearch: (search: string) => void
  openMerchantDetail: (id: number) => void
  closeMerchantDetail: () => void
  setMerchantSortBy: (sortBy: MerchantSortBy) => void
  setMerchantMergeDialogOpen: (open: boolean) => void
  openMerchantRename: (name: string) => void
  setMerchantRenameOpen: (open: boolean) => void
  setMerchantRenameName: (name: string) => void
  setMerchantRenaming: (renaming: boolean) => void
  startMerchantDelete: (id: number) => void
  cancelMerchantDelete: () => void
  setMerchantDeleting: (deleting: boolean) => void
}

export type MerchantsPageSlice = {
  merchantsPage: MerchantsPageState & MerchantsPageActions
}

const merchantsPageInitialState: MerchantsPageState = {
  search: '',
  selected: null,
  sortBy: 'spent',
  mergeDialogOpen: false,
  renameOpen: false,
  renameName: '',
  renaming: false,
  deleteConfirmId: null,
  deleting: false,
}

export const createMerchantsPageSlice = namespaceSlice('merchantsPage', (set) => ({
  ...merchantsPageInitialState,

  setMerchantSearch: (search: string) => set({ search }),
  openMerchantDetail: (id: number) => set({ selected: id }),
  closeMerchantDetail: () => set({ selected: null }),
  setMerchantSortBy: (sortBy: MerchantSortBy) => set({ sortBy }),
  setMerchantMergeDialogOpen: (open: boolean) => set({ mergeDialogOpen: open }),
  openMerchantRename: (name: string) => set({ renameName: name, renameOpen: true }),
  setMerchantRenameOpen: (open: boolean) => set({ renameOpen: open }),
  setMerchantRenameName: (name: string) => set({ renameName: name }),
  setMerchantRenaming: (renaming: boolean) => set({ renaming }),
  startMerchantDelete: (id: number) => set({ deleteConfirmId: id }),
  cancelMerchantDelete: () => set({ deleteConfirmId: null }),
  setMerchantDeleting: (deleting: boolean) => set({ deleting }),
}))
