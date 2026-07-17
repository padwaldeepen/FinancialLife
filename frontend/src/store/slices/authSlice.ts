import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../auth/api.ts'
import type { User, AuthState, AuthActions, Profile, Country } from '../../auth/types.ts'

export type AuthSlice = {
  auth: AuthState
} & AuthActions

const ACTIVE_PROFILE_KEY = 'activeProfileId'

// Pick the active profile on (re)auth: prior localStorage choice if it's still one
// of this user's profiles, otherwise the first profile. Persists the result so a
// reload keeps the same country world.
const resolveActiveProfile = (profiles: Profile[]): number | null => {
  const first = profiles.at(0)
  if (!first) return null
  const stored = localStorage.getItem(ACTIVE_PROFILE_KEY)
  const storedId = stored ? Number(stored) : null
  const resolved = (profiles.find((p) => p.id === storedId) ?? first).id
  localStorage.setItem(ACTIVE_PROFILE_KEY, String(resolved))
  return resolved
}

export const createAuthSlice = namespaceSlice('auth', (set, get) => {
  // namespaceSlice's `get` only exposes this slice's STATE fields (auth.*), not its
  // actions — `get().fetchCurrentUser` would be undefined. Close over `set` directly
  // instead of routing through get() for cross-action calls.
  const hydrateCurrentUser = async () => {
    const response = await api.get('/api/auth/me')
    set({ user: response.data as User })
  }

  const applyAuthResponse = (data: {
    access_token: string
    user_id: number
    email: string
    is_admin: boolean
    profiles: Profile[]
  }) => {
    set({
      token: data.access_token,
      user: { id: data.user_id, email: data.email, is_admin: data.is_admin },
      profiles: data.profiles,
      activeProfileId: resolveActiveProfile(data.profiles),
    })
  }

  return {
    user: null as User | null,
    token: null as string | null,
    loading: true,
    profiles: [] as Profile[],
    activeProfileId: null as number | null,

    // Login/register/refresh responses are the slim Token schema (id/email/is_admin
    // only). hydrateCurrentUser fills in the full profile (full_name, username,
    // ai_cloud_enabled, ...) from /me so `auth.user` is always one complete source of
    // truth, never assembled piecemeal across call sites.
    fetchCurrentUser: hydrateCurrentUser,

    login: async (email: string, password: string) => {
      const response = await api.post('/api/auth/login', { email, password })
      applyAuthResponse(response.data)
      await hydrateCurrentUser()
    },

    register: async (
      email: string,
      password: string,
      country: Country,
      name?: string,
      username?: string,
    ) => {
      const response = await api.post('/api/auth/register', {
        email,
        username: username || email.split('@')[0],
        password,
        full_name: name,
        country,
      })
      applyAuthResponse(response.data)
      await hydrateCurrentUser()
    },

    logout: async () => {
      try {
        await api.post('/api/auth/logout')
      } catch {
        // ignore
      }
      localStorage.removeItem(ACTIVE_PROFILE_KEY)
      set({ token: null, user: null, profiles: [], activeProfileId: null, loading: false })
    },

    verifyToken: async () => {
      set({ loading: true })
      try {
        const response = await api.post('/api/auth/refresh')
        applyAuthResponse(response.data)
        set({ loading: false })
        await hydrateCurrentUser()
      } catch {
        set({ token: null, user: null, profiles: [], activeProfileId: null, loading: false })
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

    // Switching profiles swaps the entire financial world — no partial state carries
    // over. Callers (the profile switcher UI) are responsible for clearing/refetching
    // the other slices after this resolves; profiles never blend on screen.
    setActiveProfile: (profileId: number) => {
      localStorage.setItem(ACTIVE_PROFILE_KEY, String(profileId))
      set({ activeProfileId: profileId })
    },

    addProfile: async (country: Country) => {
      const response = await api.post('/api/auth/profiles', { country })
      const newProfile = response.data as Profile
      const profiles = [...get().profiles, newProfile]
      localStorage.setItem(ACTIVE_PROFILE_KEY, String(newProfile.id))
      set({ profiles, activeProfileId: newProfile.id })
    },
  }
})
