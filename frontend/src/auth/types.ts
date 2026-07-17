export interface User {
  id: number
  email: string
  username?: string
  full_name?: string
  is_admin: boolean
  is_active?: boolean
  ai_cloud_enabled?: boolean
  name?: string
}

export type Country = 'US' | 'IN' | 'CA'

// A sealed, single-currency country world. Never merged with another profile in
// any screen — see docs/architecture-and-goals.md "Country & currency rules".
export interface Profile {
  id: number
  country: Country
  currency: string
}

export interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  profiles: Profile[]
  activeProfileId: number | null
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    country: Country,
    name?: string,
    username?: string,
  ) => Promise<void>
  logout: () => void | Promise<void>
  verifyToken: () => Promise<void>
  fetchCurrentUser: () => Promise<void>
  updateAiCloudEnabled: (enabled: boolean) => Promise<void>
  setActiveProfile: (profileId: number) => void
  addProfile: (country: Country) => Promise<void>
}
