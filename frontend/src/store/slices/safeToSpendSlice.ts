import { namespaceSlice, isFresh, getErrorDetail } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

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

// --- Y2: net worth over time ---------------------------------------------------------

export interface NetWorthPoint {
  month: string
  assets: number
  liabilities: number
  net_worth: number
}

export type NetWorthSlice = {
  netWorth: {
    points: NetWorthPoint[]
    insufficientData: boolean
    monthsAvailable: number
    loading: boolean
    lastFetchedAt: number | null
    fetchNetWorth: (opts?: { force?: boolean }) => Promise<void>
  }
}

export const createNetWorthSlice = namespaceSlice('netWorth', (set, get) => ({
  points: [] as NetWorthPoint[],
  // Assume insufficient until the server says otherwise, so a slow load never flashes a
  // misleading empty trend.
  insufficientData: true,
  monthsAvailable: 0,
  loading: true,
  lastFetchedAt: null as number | null,

  fetchNetWorth: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/insights/net-worth')
      set({
        points: res.data.points,
        insufficientData: res.data.insufficient_data,
        monthsAvailable: res.data.months_available,
        lastFetchedAt: Date.now(),
      })
    } catch (error) {
      toast.error(getErrorDetail(error, 'Could not load net worth'))
    } finally {
      set({ loading: false })
    }
  },
}))
