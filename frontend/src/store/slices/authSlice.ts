import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'
import type { User, AuthState, AuthActions } from '../../auth/types.ts'

export type AuthSlice = {
  auth: AuthState
} & AuthActions

export const createAuthSlice = namespaceSlice('auth', (set, get) => {
  // namespaceSlice's `get` only exposes this slice's STATE fields (auth.*), not its
  // actions — `get().fetchCurrentUser` would be undefined. Close over `set` directly
  // instead of routing through get() for cross-action calls.
  const hydrateCurrentUser = async () => {
    const response = await api.get('/api/auth/me')
    set({ user: response.data as User })
  }

  return {
    user: null as User | null,
    token: null as string | null,
    loading: true,

    // Login/register/refresh responses are the slim Token schema (id/email/is_admin
    // only). hydrateCurrentUser fills in the full profile (full_name, username,
    // ai_cloud_enabled, ...) from /me so `auth.user` is always one complete source of
    // truth, never assembled piecemeal across call sites.
    fetchCurrentUser: hydrateCurrentUser,

    login: async (email: string, password: string) => {
      const response = await api.post('/api/auth/login', { email, password })
      const { access_token, user_id, email: userEmail, is_admin } = response.data
      set({ token: access_token, user: { id: user_id, email: userEmail, is_admin } })
      await hydrateCurrentUser()
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
      await hydrateCurrentUser()
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
        await hydrateCurrentUser()
      } catch {
        set({ token: null, user: null, loading: false })
      }
    },

    updateAiCloudEnabled: async (enabled: boolean) => {
      const previous = get().user
      // Optimistic update, revert on failure — same pattern as the other slices.
      set({ user: previous ? { ...previous, ai_cloud_enabled: enabled } : previous })
      try {
        const response = await api.put('/api/auth/me/ai-settings', { ai_cloud_enabled: enabled })
        set({ user: response.data as User })
      } catch (err) {
        set({ user: previous })
        throw err
      }
    },
  }
})
