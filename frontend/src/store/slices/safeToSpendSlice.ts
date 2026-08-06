import { namespaceSlice, isFresh } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'

export interface SafeToSpendData {
  insufficient_data: boolean
  message: string | null
  safe_to_spend: number | null
  cash_balance: number | null
  next_payday: string | null
  days_until_payday: number | null
  bills_before_payday: number
  goal_contributions_due: number
}

export type SafeToSpendSlice = {
  safeToSpend: {
    data: SafeToSpendData | null
    loading: boolean
    lastFetchedAt: number | null
    fetchSafeToSpend: (opts?: { force?: boolean }) => Promise<void>
  }
}

export const createSafeToSpendSlice = namespaceSlice('safeToSpend', (set, get) => ({
  data: null as SafeToSpendData | null,
  loading: true,
  lastFetchedAt: null as number | null,

  fetchSafeToSpend: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/insights/safe-to-spend')
      set({ data: res.data, lastFetchedAt: Date.now() })
    } finally {
      set({ loading: false })
    }
  },
}))
