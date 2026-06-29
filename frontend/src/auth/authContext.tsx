import { createContext, useContext, useEffect, useRef, type ReactNode, type JSX } from 'react'
import { useShallow } from 'zustand/react/shallow'
import api from './api.ts'
import { useBoundStore } from '../store/useBoundStore.ts'
import type { User } from './types.ts'

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.request.use(
  (config) => {
    const { token } = useBoundStore.getState().auth
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await api.post('/api/auth/refresh')
        const { access_token } = response.data
        useBoundStore.setState((s) => ({ auth: { ...s.auth, token: access_token } }))
        processQueue(null, access_token)
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        useBoundStore.getState().logout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  isAuthenticated: false,
  isAdmin: false,
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const initialized = useRef(false)

  const { user, token, loading } = useBoundStore(
    useShallow((s) => ({
      user: s.auth.user,
      token: s.auth.token,
      loading: s.auth.loading,
    })),
  )

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      useBoundStore.getState().verifyToken()
    }
  }, [])

  const value: AuthContextValue = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.is_admin ?? false,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
