import { namespaceSlice, isFresh, getErrorDetail, refetchCollection } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

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
    lastFetchedAt: number | null
    fetchCategories: (opts?: { force?: boolean }) => Promise<void>
    fetchSpendingByCategory: (days?: number) => Promise<void>
    createCategory: (data: {
      name: string
      color?: string
      parent_id?: number | null
    }) => Promise<void>
    updateCategory: (
      id: number,
      data: { name?: string; color?: string; parent_id?: number | null },
    ) => Promise<void>
    deleteCategory: (id: number) => Promise<void>
  }
}

export const createCategoriesSlice = namespaceSlice('categories', (set, get) => ({
  tree: [] as CategoryNode[],
  flat: [] as FlatCategory[],
  loading: true,
  spending: [] as CategorySpending[],
  spendingLoading: false,
  lastFetchedAt: null as number | null,

  fetchCategories: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/categories/')
      const tree = res.data as CategoryNode[]
      set({ tree, flat: flattenCategories(tree), lastFetchedAt: Date.now() })
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

  createCategory: async (data: { name: string; color?: string; parent_id?: number | null }) => {
    try {
      await api.post('/api/categories/', data)
      await refetchCollection<CategoryNode[]>(set, '/api/categories/', 'tree', (tree) => ({
        tree,
        flat: flattenCategories(tree),
      }))
      toast.success('Category created')
    } catch (error) {
      // No throw: Categories.tsx's dialog closes unconditionally on save today (no
      // catch of its own) — surfacing the error via toast without rethrowing keeps
      // that behavior while at least telling the user something went wrong.
      toast.error(getErrorDetail(error, 'Failed to save category'))
    }
  },

  updateCategory: async (
    id: number,
    data: { name?: string; color?: string; parent_id?: number | null },
  ) => {
    try {
      await api.put(`/api/categories/${id}`, data)
      await refetchCollection<CategoryNode[]>(set, '/api/categories/', 'tree', (tree) => ({
        tree,
        flat: flattenCategories(tree),
      }))
      toast.success('Category updated')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to save category'))
    }
  },

  deleteCategory: async (id: number) => {
    try {
      await api.delete(`/api/categories/${id}`)
      await refetchCollection<CategoryNode[]>(set, '/api/categories/', 'tree', (tree) => ({
        tree,
        flat: flattenCategories(tree),
      }))
      toast.success('Category deleted')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to delete category'))
    }
  },
}))

// --- Category form/dialog state (merged from categoriesFormSlice.ts) ---

export interface CategoryFormFields {
  name: string
  color: string
  parent_id: number | null
}

export interface CategoriesFormState {
  expanded: Set<number>
  dialogOpen: boolean
  editId: number | null
  form: CategoryFormFields
  saving: boolean
  deleteId: number | null
  deleting: boolean
}

export interface CategoriesFormActions {
  toggleCategoryExpand: (id: number) => void
  openCategoryCreate: () => void
  openCategoryEdit: (cat: {
    id: number
    name: string
    color: string
    parent_id: number | null
  }) => void
  setCategoryDialogOpen: (open: boolean) => void
  setCategoryFormField: (
    field: keyof CategoryFormFields,
    value: CategoryFormFields[keyof CategoryFormFields],
  ) => void
  setCategorySaving: (saving: boolean) => void
  startCategoryDelete: (id: number) => void
  cancelCategoryDelete: () => void
  setCategoryDeleting: (deleting: boolean) => void
}

export type CategoriesFormSlice = {
  categoriesForm: CategoriesFormState & CategoriesFormActions
}

const emptyForm = (): CategoryFormFields => ({ name: '', color: '#6B7280', parent_id: null })

const categoriesFormInitialState: CategoriesFormState = {
  expanded: new Set<number>(),
  dialogOpen: false,
  editId: null,
  form: emptyForm(),
  saving: false,
  deleteId: null,
  deleting: false,
}

export const createCategoriesFormSlice = namespaceSlice('categoriesForm', (set, get) => ({
  ...categoriesFormInitialState,

  toggleCategoryExpand: (id: number) => {
    const next = new Set(get().expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    set({ expanded: next })
  },

  openCategoryCreate: () => {
    set({ editId: null, form: emptyForm(), dialogOpen: true })
  },

  openCategoryEdit: (cat: {
    id: number
    name: string
    color: string
    parent_id: number | null
  }) => {
    set({
      editId: cat.id,
      form: { name: cat.name, color: cat.color, parent_id: cat.parent_id },
      dialogOpen: true,
    })
  },

  setCategoryDialogOpen: (open: boolean) => {
    set({ dialogOpen: open })
  },

  setCategoryFormField: (
    field: keyof CategoryFormFields,
    value: CategoryFormFields[keyof CategoryFormFields],
  ) => {
    set({ form: { ...get().form, [field]: value } })
  },

  setCategorySaving: (saving: boolean) => {
    set({ saving })
  },

  startCategoryDelete: (id: number) => {
    set({ deleteId: id })
  },

  cancelCategoryDelete: () => {
    set({ deleteId: null })
  },

  setCategoryDeleting: (deleting: boolean) => {
    set({ deleting })
  },
}))
