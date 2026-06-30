import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'

interface Merchant {
  id: number
  name: string
  normalized_name: string
  aliases: string[] | null
  is_hidden: boolean
  transaction_count: number
  total_spent: number
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
  }
  fetchMerchants: () => Promise<void>
  fetchMerchantDetail: (id: number) => Promise<void>
  toggleHidden: (id: number, current: boolean) => Promise<void>
  fetchSimilar: () => Promise<void>
  doMerge: (targetId: number, sourceId: number) => Promise<void>
}

export const createMerchantsSlice = namespaceSlice('merchants', (set, _get) => ({
  items: [] as Merchant[],
  loading: true,
  detail: null as DetailData | null,
  similarPairs: [] as SimilarPair[],

  fetchMerchants: async () => {
    set({ loading: true })
    try {
      const res = await api.get('/api/merchants/')
      set({ items: res.data })
    } finally {
      set({ loading: false })
    }
  },

  fetchMerchantDetail: async (id: number) => {
    try {
      const res = await api.get(`/api/merchants/${id}`)
      set({ detail: res.data })
    } catch {
      // handled by caller
    }
  },

  toggleHidden: async (id: number, current: boolean) => {
    await api.put(`/api/merchants/${id}`, { is_hidden: !current })
    const res = await api.get('/api/merchants/')
    set({ items: res.data })
  },

  fetchSimilar: async () => {
    const res = await api.get('/api/merchants/similar/')
    set({ similarPairs: res.data })
  },

  doMerge: async (targetId: number, sourceId: number) => {
    await api.post('/api/merchants/merge', { target_id: targetId, source_ids: [sourceId] })
    const res = await api.get('/api/merchants/')
    set({ items: res.data, similarPairs: [] })
  },
}))
