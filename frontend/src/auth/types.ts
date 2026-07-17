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

export interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string, username?: string) => Promise<void>
  logout: () => void | Promise<void>
  verifyToken: () => Promise<void>
  fetchCurrentUser: () => Promise<void>
  updateAiCloudEnabled: (enabled: boolean) => Promise<void>
}
