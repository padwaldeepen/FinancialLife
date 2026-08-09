export interface User {
  id: number
  email: string
  username?: string
  full_name?: string
  is_admin: boolean
  is_active?: boolean
  ai_cloud_enabled?: boolean
}
// Y5: there was also a `name?: string` here that **nothing ever set** — `/api/auth/me`
// and the register/login responses all return `full_name`. Its only effect was to make
// `user?.name || 'Not set'` typecheck while always falling through, which is exactly how
// mobile Settings ended up permanently showing "Not set". Removed so the compiler
// catches the next reader that reaches for it.

export type Country = 'US' | 'IN' | 'CA'

// A sealed, single-currency country world. Never merged with another profile in
// any screen — see docs/architecture-and-goals.md "Country & currency rules".
export interface Profile {
  id: number
  country: Country
  currency: string
}
