import { namespaceSlice, getErrorDetail, refetchCollection } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

export interface AdminUser {
  id: number
  email: string
  username: string
  full_name: string | null
  is_admin: boolean
  is_active: boolean
  profile_count: number
  created_at: string
}

export interface SystemCategory {
  id: number
  name: string
  color: string
  parent_id: number | null
}

export interface AdminStatus {
  user_count: number
  active_user_count: number
  pending_documents: number
  total_transactions: number
  backup_configured: boolean
  last_backup: string | null
}

export interface AdminUserCreate {
  email: string
  username: string
  password: string
  full_name?: string | null
  country: 'US' | 'IN' | 'CA'
}

export type AdminSlice = {
  admin: {
    users: AdminUser[]
    systemCategories: SystemCategory[]
    status: AdminStatus | null
    loading: boolean
    fetchAdminUsers: () => Promise<void>
    createAdminUser: (payload: AdminUserCreate) => Promise<void>
    setUserActive: (userId: number, isActive: boolean) => Promise<void>
    fetchSystemCategories: () => Promise<void>
    createSystemCategory: (name: string, color: string) => Promise<void>
    updateSystemCategory: (id: number, data: { name?: string; color?: string }) => Promise<void>
    deleteSystemCategory: (id: number) => Promise<void>
    fetchAdminStatus: () => Promise<void>
    triggerBackup: () => Promise<void>
  }
}

// A1's admin API surfaced here (A2). Every route is server-gated by `require_admin`; the
// UI additionally only mounts the Admin tab when `auth.user.is_admin`, so a non-admin
// never sees or calls these. Mutations refetch the affected list (small, admin-only data).
export const createAdminSlice = namespaceSlice('admin', (set, get) => ({
  users: [] as AdminUser[],
  systemCategories: [] as SystemCategory[],
  status: null as AdminStatus | null,
  loading: false,

  fetchAdminUsers: async () => {
    set({ loading: true })
    try {
      const res = await api.get('/api/admin/users')
      set({ users: res.data })
    } finally {
      set({ loading: false })
    }
  },

  createAdminUser: async (payload: AdminUserCreate) => {
    try {
      await api.post('/api/admin/users', payload)
      // Refetch inline — sibling actions aren't reachable via this slice's `get()`
      // (namespaceSlice hoists actions to the store root; `get()` returns only state).
      await refetchCollection<AdminUser[]>(set, '/api/admin/users', 'users')
      toast.success('User created — they can log in now')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Could not create user'))
      throw error
    }
  },

  // Not thrown on failure: AdminTab's activate/deactivate button fires this
  // without awaiting or catching, so a throw here would only surface as an
  // unhandled rejection. The toast is the only feedback channel that reaches the UI.
  setUserActive: async (userId: number, isActive: boolean) => {
    try {
      const res = await api.patch(`/api/admin/users/${userId}/active`, { is_active: isActive })
      const updated = res.data as AdminUser
      const current: AdminUser[] = get().users
      set({ users: current.map((u) => (u.id === userId ? updated : u)) })
    } catch (error) {
      toast.error(getErrorDetail(error, 'Could not update user'))
    }
  },

  fetchSystemCategories: async () => {
    const res = await api.get('/api/admin/system-categories')
    set({ systemCategories: res.data })
  },

  createSystemCategory: async (name: string, color: string) => {
    try {
      await api.post('/api/admin/system-categories', { name, color })
      await refetchCollection<SystemCategory[]>(
        set,
        '/api/admin/system-categories',
        'systemCategories',
      )
      toast.success('Category added')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Could not add category'))
      throw error
    }
  },

  // Not thrown on failure — SystemCategoryRow's rename/recolor call this without
  // awaiting or catching (same reasoning as setUserActive above).
  updateSystemCategory: async (id: number, data: { name?: string; color?: string }) => {
    try {
      await api.patch(`/api/admin/system-categories/${id}`, data)
      await refetchCollection<SystemCategory[]>(
        set,
        '/api/admin/system-categories',
        'systemCategories',
      )
    } catch (error) {
      toast.error(getErrorDetail(error, 'Could not update category'))
    }
  },

  deleteSystemCategory: async (id: number) => {
    const previous: SystemCategory[] = get().systemCategories
    set({ systemCategories: previous.filter((c) => c.id !== id) })
    try {
      await api.delete(`/api/admin/system-categories/${id}`)
    } catch {
      set({ systemCategories: previous })
      toast.error('Could not delete category')
    }
  },

  fetchAdminStatus: async () => {
    const res = await api.get('/api/admin/status')
    set({ status: res.data })
  },

  triggerBackup: async () => {
    const res = await api.post('/api/admin/backup')
    const { status, message } = res.data as { status: string; message: string }
    if (status === 'started') toast.success(message)
    else toast.error(message)
  },
}))

// --- Admin form/dialog state (merged from adminFormSlice.ts) ---

export interface AdminFormState {
  userDialogOpen: boolean
  userForm: AdminUserCreate
  savingUser: boolean
  newCatName: string
  newCatColor: string
  editingSystemCategoryId: number | null
  systemCategoryDraft: string
}

export interface AdminFormActions {
  setUserDialogOpen: (open: boolean) => void
  setUserFormField: (field: keyof AdminUserCreate, value: string) => void
  setSavingUser: (saving: boolean) => void
  resetUserForm: () => void
  setNewCatName: (name: string) => void
  setNewCatColor: (color: string) => void
  resetNewCategoryForm: () => void
  startSystemCategoryEdit: (id: number, name: string) => void
  cancelSystemCategoryEdit: () => void
  setSystemCategoryDraft: (draft: string) => void
}

export type AdminFormSlice = {
  adminForm: AdminFormState & AdminFormActions
}

const emptyUser = (): AdminUserCreate => ({
  email: '',
  username: '',
  password: '',
  full_name: '',
  country: 'US',
})

const adminFormInitialState: AdminFormState = {
  userDialogOpen: false,
  userForm: emptyUser(),
  savingUser: false,
  newCatName: '',
  newCatColor: '#6B7280',
  editingSystemCategoryId: null,
  systemCategoryDraft: '',
}

export const createAdminFormSlice = namespaceSlice('adminForm', (set, get) => ({
  ...adminFormInitialState,

  setUserDialogOpen: (open: boolean) => set({ userDialogOpen: open }),

  setUserFormField: (field: keyof AdminUserCreate, value: string) => {
    set({ userForm: { ...get().userForm, [field]: value } })
  },

  setSavingUser: (saving: boolean) => set({ savingUser: saving }),

  resetUserForm: () => set({ userForm: emptyUser() }),

  setNewCatName: (name: string) => set({ newCatName: name }),
  setNewCatColor: (color: string) => set({ newCatColor: color }),
  resetNewCategoryForm: () => set({ newCatName: '', newCatColor: '#6B7280' }),

  startSystemCategoryEdit: (id: number, name: string) => {
    set({ editingSystemCategoryId: id, systemCategoryDraft: name })
  },

  cancelSystemCategoryEdit: () => {
    set({ editingSystemCategoryId: null, systemCategoryDraft: '' })
  },

  setSystemCategoryDraft: (draft: string) => set({ systemCategoryDraft: draft }),
}))
