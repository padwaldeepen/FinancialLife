import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'
import type { User, AuthState, AuthActions } from '../../auth/types.ts'

export type AuthSlice = {
  auth: AuthState
} & AuthActions

export const createAuthSlice = namespaceSlice('auth', (set, _get) => ({
  user: null as User | null,
  token: null as string | null,
  loading: true,

  login: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password })
    const { access_token, user_id, email: userEmail, is_admin } = response.data
    set({ token: access_token, user: { id: user_id, email: userEmail, is_admin } })
  },

  register: async (email: string, password: string, name?: string, username?: string) => {
    const response = await api.post('/api/auth/register', {
      email,
      username: username || email.split('@')[0],
      password,
      full_name: name,
    })
    const { access_token, user_id, email: userEmail, is_admin } = response.data
    set({ token: access_token, user: { id: user_id, email: userEmail, is_admin, name } })
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // ignore
    }
    set({ token: null, user: null, loading: false })
  },

  verifyToken: async () => {
    set({ loading: true })
    try {
      const response = await api.post('/api/auth/refresh')
      const { access_token, user_id, email, is_admin } = response.data
      set({ token: access_token, user: { id: user_id, email, is_admin }, loading: false })
    } catch {
      set({ token: null, user: null, loading: false })
    }
  },
}))
