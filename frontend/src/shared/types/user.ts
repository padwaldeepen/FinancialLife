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
