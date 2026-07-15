import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'

interface UpcomingBill {
  id: number
  name: string
  amount: number
  amount_estimated: number | null
  frequency: string
  due_day: number
  next_due: string
  days_until: number
  category_name: string | null
  account_name: string | null
  merchant_name: string | null
  is_variable: boolean
  has_paid: boolean
}

interface Bill {
  id: number
  name: string
  amount: number
  amount_estimated: number | null
  frequency: string
  due_day: number
  category_id: number | null
  category_name: string | null
  merchant_id: number | null
  merchant_name: string | null
  account_id: number
  account_name: string | null
  is_active: boolean
  is_variable: boolean
  notes: string | null
  created_at: string
}

export type BillsSlice = {
  bills: {
    items: Bill[]
    upcoming: UpcomingBill[]
    loading: boolean
    billHistory: {
      transactions: any[]
      monthly_spending: any[]
      loading: boolean
    }
  }
  fetchBills: () => Promise<void>
  fetchUpcomingBills: (days?: number) => Promise<void>
  fetchBillHistory: (billId: number) => Promise<void>
  createBill: (data: {
    name: string
    amount: number
    frequency: string
    due_day: number
    account_id: number
    category_id?: number | null
    is_variable?: boolean
    notes?: string | null
  }) => Promise<void>
  updateBill: (
    id: number,
    data: {
      name?: string
      amount?: number
      frequency?: string
      due_day?: number
      account_id?: number
      category_id?: number | null
      is_variable?: boolean
      is_active?: boolean
      notes?: string | null
    },
  ) => Promise<void>
  deleteBill: (id: number) => Promise<void>
  suggestBillLink: (data: {
    description: string
    amount: number
    date: string
    merchant_id: number | null
  }) => Promise<{
    bill_id: number
    bill_name: string
    bill_amount: number
    confidence: string
  } | null>
  linkTransactionToBill: (billId: number, transactionId: number) => Promise<void>
}

export const createBillsSlice = namespaceSlice('bills', (set, get) => ({
  items: [] as Bill[],
  upcoming: [] as UpcomingBill[],
  loading: true,
  billHistory: { transactions: [], monthly_spending: [], loading: false },

  fetchBills: async () => {
    set({ loading: true })
    try {
      const res = await api.get('/api/bills/')
      set({ items: res.data })
    } finally {
      set({ loading: false })
    }
  },

  fetchUpcomingBills: async (days = 30) => {
    try {
      const res = await api.get(`/api/bills/upcoming?days=${days}`)
      set({ upcoming: res.data })
    } catch {
      // silent
    }
  },

  fetchBillHistory: async (billId: number) => {
    set({ billHistory: { transactions: [], monthly_spending: [], loading: true } })
    try {
      const res = await api.get(`/api/bills/${billId}/history`)
      set({
        billHistory: {
          transactions: res.data.transactions,
          monthly_spending: res.data.monthly_spending,
          loading: false,
        },
      })
    } catch {
      set({ billHistory: { transactions: [], monthly_spending: [], loading: false } })
    }
  },

  createBill: async (data: {
    name: string
    amount: number
    frequency: string
    due_day: number
    account_id: number
    category_id?: number | null
    is_variable?: boolean
    notes?: string | null
  }) => {
    await api.post('/api/bills/', data)
    const res = await api.get('/api/bills/')
    set({ items: res.data })
  },

  updateBill: async (
    id: number,
    data: {
      name?: string
      amount?: number
      frequency?: string
      due_day?: number
      account_id?: number
      category_id?: number | null
      is_variable?: boolean
      is_active?: boolean
      notes?: string | null
    },
  ) => {
    await api.put(`/api/bills/${id}`, data)
    const res = await api.get('/api/bills/')
    set({ items: res.data })
  },

  deleteBill: async (id: number) => {
    await api.delete(`/api/bills/${id}`)
    const state = get()
    set({ items: state.items.filter((b: Bill) => b.id !== id) })
  },

  suggestBillLink: async (data: {
    description: string
    amount: number
    date: string
    merchant_id: number | null
  }) => {
    try {
      const res = await api.post('/api/bills/suggest-link', data)
      return res.data as {
        bill_id: number
        bill_name: string
        bill_amount: number
        confidence: string
      } | null
    } catch {
      return null
    }
  },

  linkTransactionToBill: async (billId: number, transactionId: number) => {
    await api.post(`/api/bills/${billId}/link/${transactionId}`)
  },
}))
