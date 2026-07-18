import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'

interface MonthlyEntry {
  month: string
  income: number
  expense: number
  net: number
}

interface Summary {
  total_income: number
  total_expense: number
  net: number
  transaction_count: number
  avg_daily_expense: number
  top_category: string | null
  top_category_amount: number | null
}

export interface CategoryTotal {
  category_id: number
  category_name: string
  category_color: string
  total: number
  percentage: number
  transaction_count: number
}

export interface MerchantTotal {
  merchant_id: number
  merchant_name: string
  total: number
  percentage: number
  transaction_count: number
}

export interface Comparison {
  label: string
  current_income: number
  current_expense: number
  current_net: number
  previous_income: number
  previous_expense: number
  previous_net: number
  income_change_pct: number | null
  expense_change_pct: number | null
  net_change_pct: number | null
}

export type ReportsSlice = {
  reports: {
    monthly: MonthlyEntry[]
    summary: Summary | null
    categories: CategoryTotal[]
    comparison: Comparison | null
    // Insights page (U6) — period-scoped to a specific calendar month, distinct from
    // the rolling-window `categories`/`comparison` above that Home (U3) still reads.
    periodCategories: CategoryTotal[]
    periodMerchants: MerchantTotal[]
    periodComparisonMoM: Comparison | null
    periodComparisonYoY: Comparison | null
    periodLoading: boolean
    loading: boolean
  }
  fetchReports: (year?: string) => Promise<void>
  fetchMonthly: (year: number) => Promise<void>
  fetchInsightsPeriod: (year: number, month: number) => Promise<void>
  fetchCategoriesForMonth: (year: number, month: number) => Promise<CategoryTotal[]>
}

export const createReportsSlice = namespaceSlice('reports', (set) => ({
  monthly: [] as MonthlyEntry[],
  summary: null as Summary | null,
  categories: [] as CategoryTotal[],
  comparison: null as Comparison | null,
  periodCategories: [] as CategoryTotal[],
  periodMerchants: [] as MerchantTotal[],
  periodComparisonMoM: null as Comparison | null,
  periodComparisonYoY: null as Comparison | null,
  periodLoading: true,
  loading: true,

  // Unchanged — Home (both trees, U3) depends on this exact signature and on
  // `summary`/`comparison` being populated as a side effect. Insights (U6) does not
  // use this; it has its own period-scoped fetchers below.
  fetchReports: async (year?: string) => {
    set({ loading: true })
    try {
      const y = year ?? new Date().getFullYear().toString()
      const [monthlyRes, summaryRes, catRes, compRes] = await Promise.all([
        api.get(`/api/reports/monthly?year=${y}`),
        api.get('/api/reports/summary?days=30'),
        api.get('/api/reports/categories?days=90'),
        api.get('/api/reports/comparison'),
      ])
      set({
        monthly: monthlyRes.data as MonthlyEntry[],
        summary: summaryRes.data as Summary,
        categories: catRes.data as CategoryTotal[],
        comparison: compRes.data as Comparison,
      })
    } finally {
      set({ loading: false })
    }
  },

  // The annual/timeline chart's data source — 12 months for the given year, no other
  // period-scoped state changes with it (re-fetched only when the year selector moves).
  fetchMonthly: async (year: number) => {
    const res = await api.get(`/api/reports/monthly?year=${year}`)
    set({ monthly: res.data as MonthlyEntry[] })
  },

  // Everything the main Insights breakdown (category + merchant bars, MoM/YoY cards)
  // needs for one specific calendar month, fetched together since they all change
  // together when the period selector moves.
  fetchInsightsPeriod: async (year: number, month: number) => {
    set({ periodLoading: true })
    try {
      const [catRes, merRes, momRes, yoyRes] = await Promise.all([
        api.get('/api/reports/categories', { params: { year, month } }),
        api.get('/api/reports/merchants', { params: { year, month } }),
        api.get('/api/reports/comparison', { params: { year, month, mode: 'mom' } }),
        api.get('/api/reports/comparison', { params: { year, month, mode: 'yoy' } }),
      ])
      set({
        periodCategories: catRes.data as CategoryTotal[],
        periodMerchants: merRes.data as MerchantTotal[],
        periodComparisonMoM: momRes.data as Comparison,
        periodComparisonYoY: yoyRes.data as Comparison,
      })
    } finally {
      set({ periodLoading: false })
    }
  },

  // For the timeline's hover/tap-to-preview interaction — returns directly rather than
  // writing to slice state, so the component can keep its own small hover cache
  // (Map<"year-month", CategoryTotal[]>) without a global-state re-render per hover.
  fetchCategoriesForMonth: async (year: number, month: number) => {
    const res = await api.get('/api/reports/categories', { params: { year, month } })
    return res.data as CategoryTotal[]
  },
}))
