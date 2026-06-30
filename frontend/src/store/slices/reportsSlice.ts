import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'

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

interface CategoryTotal {
  category_name: string
  category_color: string
  total: number
  percentage: number
  transaction_count: number
}

export type ReportsSlice = {
  reports: {
    monthly: MonthlyEntry[]
    summary: Summary | null
    categories: CategoryTotal[]
    loading: boolean
  }
  fetchReports: (year?: string) => Promise<void>
}

export const createReportsSlice = namespaceSlice('reports', (set) => ({
  monthly: [] as MonthlyEntry[],
  summary: null as Summary | null,
  categories: [] as CategoryTotal[],
  loading: true,

  fetchReports: async (year?: string) => {
    set({ loading: true })
    try {
      const y = year ?? new Date().getFullYear().toString()
      const [monthlyRes, summaryRes, catRes] = await Promise.all([
        api.get(`/api/reports/monthly?year=${y}`),
        api.get('/api/reports/summary?days=30'),
        api.get('/api/reports/categories?days=90'),
      ])
      set({
        monthly: monthlyRes.data as MonthlyEntry[],
        summary: summaryRes.data as Summary,
        categories: catRes.data as CategoryTotal[],
      })
    } finally {
      set({ loading: false })
    }
  },
}))
