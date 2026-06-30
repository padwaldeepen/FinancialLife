import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'

interface CategoryNode {
  id: number
  name: string
  color: string
  icon: string | null
  is_system: boolean
  parent_id: number | null
  children: CategoryNode[]
}

interface FlatCategory {
  id: number
  name: string
  color: string
  depth: number
}

export interface CategorySpending {
  id: number
  name: string
  color: string
  total: number
  percentage: number
  transaction_count: number
}

const flattenCategories = (cats: CategoryNode[], depth = 0): FlatCategory[] => {
  const result: FlatCategory[] = []
  for (const cat of cats) {
    result.push({ id: cat.id, name: cat.name, color: cat.color, depth })
    if (cat.children.length > 0) {
      result.push(...flattenCategories(cat.children, depth + 1))
    }
  }
  return result
}

export type CategoriesSlice = {
  categories: {
    tree: CategoryNode[]
    flat: FlatCategory[]
    loading: boolean
    spending: CategorySpending[]
    spendingLoading: boolean
  }
  fetchCategories: () => Promise<void>
  fetchSpendingByCategory: (days?: number) => Promise<void>
}

export const createCategoriesSlice = namespaceSlice('categories', (set) => ({
  tree: [] as CategoryNode[],
  flat: [] as FlatCategory[],
  loading: true,
  spending: [] as CategorySpending[],
  spendingLoading: false,

  fetchCategories: async () => {
    set({ loading: true, tree: [], flat: [] })
    try {
      const res = await api.get('/api/categories/')
      const tree = res.data as CategoryNode[]
      set({ tree, flat: flattenCategories(tree) })
    } finally {
      set({ loading: false })
    }
  },

  fetchSpendingByCategory: async (days = 90) => {
    set({ spendingLoading: true })
    try {
      const res = await api.get(`/api/categories/spending?days=${days}`)
      set({ spending: res.data as CategorySpending[] })
    } finally {
      set({ spendingLoading: false })
    }
  },
}))
