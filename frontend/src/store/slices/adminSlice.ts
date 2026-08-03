import { namespaceSlice } from '../namespaceSlice.ts'
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
  }
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
    await api.post('/api/admin/users', payload)
    // Refetch inline — sibling actions aren't reachable via this slice's `get()`
    // (namespaceSlice hoists actions to the store root; `get()` returns only state).
    const res = await api.get('/api/admin/users')
    set({ users: res.data })
  },

  setUserActive: async (userId: number, isActive: boolean) => {
    try {
      const res = await api.patch(`/api/admin/users/${userId}/active`, { is_active: isActive })
      const updated = res.data as AdminUser
      const current: AdminUser[] = get().users
      set({ users: current.map((u) => (u.id === userId ? updated : u)) })
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Could not update user')
    }
  },

  fetchSystemCategories: async () => {
    const res = await api.get('/api/admin/system-categories')
    set({ systemCategories: res.data })
  },

  createSystemCategory: async (name: string, color: string) => {
    await api.post('/api/admin/system-categories', { name, color })
    const res = await api.get('/api/admin/system-categories')
    set({ systemCategories: res.data })
  },

  updateSystemCategory: async (id: number, data: { name?: string; color?: string }) => {
    await api.patch(`/api/admin/system-categories/${id}`, data)
    const res = await api.get('/api/admin/system-categories')
    set({ systemCategories: res.data })
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
