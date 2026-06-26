import { type StateCreator } from 'zustand'
import type { StoreState } from '../types.ts'
import api from '../../utils/api.ts'

export interface User {
  id: number
  email: string
  name?: string
}

export interface AuthSlice {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
  verifyToken: () => Promise<void>
}

export const createAuthSlice: StateCreator<StoreState, [], [], AuthSlice> = (set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,

  login: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password })
    const { access_token, user_id, email: userEmail } = response.data
    localStorage.setItem('token', access_token)
    set({ token: access_token, user: { id: user_id, email: userEmail } })
  },

  register: async (email: string, password: string, name?: string) => {
    const username = email.split('@')[0]
    const response = await api.post('/api/auth/register', {
      email,
      username,
      password,
      full_name: name,
    })
    const { access_token, user_id, email: userEmail } = response.data
    localStorage.setItem('token', access_token)
    set({
      token: access_token,
      user: { id: user_id, email: userEmail, name },
    })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null })
  },

  verifyToken: async () => {
    const token = get().token
    if (!token) return
    set({ loading: true })
    try {
      const response = await api.get('/api/auth/me')
      set({ user: response.data, loading: false })
    } catch {
      localStorage.removeItem('token')
      set({ token: null, user: null, loading: false })
    }
  },
})
