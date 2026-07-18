import api from './client.ts'
import { useBoundStore } from '../../store/useBoundStore.ts'

// Side-effect module — configures the shared axios instance's request/response
// interceptors. Imported exactly once, from main.tsx, never from a slice: slices
// import `api` from client.ts directly, so this can safely depend on the store
// without creating an import cycle (store slices -> client.ts -> store).
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
    const { token, activeProfileId } = useBoundStore.getState().auth
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Every financial route requires this — the backend's get_current_profile
    // dependency 404s without it. Auth-only routes (login/register/refresh/me/
    // profiles) ignore it, so it's safe to always attach when known.
    if (activeProfileId != null) {
      config.headers['X-Profile-Id'] = String(activeProfileId)
    }
    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/auth/refresh')
    ) {
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
