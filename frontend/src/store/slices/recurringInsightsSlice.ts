import { namespaceSlice, isFresh } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

export interface RecurringCharge {
  group_key: string
  merchant_id: number | null
  display_name: string
  transaction_type: string
  is_subscription: boolean
  price_hike: boolean
  avg_amount: number
  cadence: string
  monthly_equivalent: number
  next_expected_date: string
  occurrence_count: number
  confidence: number
  transaction_ids: number[]
}

export type RecurringInsightsSlice = {
  recurringInsights: {
    items: RecurringCharge[]
    loading: boolean
    lastFetchedAt: number | null
  }
  fetchRecurringInsights: (opts?: { force?: boolean }) => Promise<void>
  dismissRecurringGroup: (groupKey: string) => Promise<void>
}

export const createRecurringInsightsSlice = namespaceSlice('recurringInsights', (set, get) => ({
  items: [] as RecurringCharge[],
  loading: true,
  lastFetchedAt: null as number | null,

  fetchRecurringInsights: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/insights/recurring')
      set({ items: res.data, lastFetchedAt: Date.now() })
    } finally {
      set({ loading: false })
    }
  },

  dismissRecurringGroup: async (groupKey: string) => {
    const items: RecurringCharge[] = get().items
    set({ items: items.filter((c) => c.group_key !== groupKey) })
    try {
      await api.post('/api/insights/recurring/dismiss', { group_key: groupKey })
    } catch {
      set({ items })
      toast.error('Failed to dismiss')
    }
  },
}))
