import api from './client.ts'
import { useBoundStore } from '../../store/useBoundStore.ts'
import { refreshAccessToken, isDefiniteAuthFailure } from './authRefresh.ts'

// Side-effect module — configures the shared axios instance's request/response
// interceptors. Imported exactly once, from main.tsx, never from a slice: slices
// import `api` from client.ts directly, so this can safely depend on the store
// without creating an import cycle (store slices -> client.ts -> store).

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
      originalRequest._retry = true

      try {
        const { access_token } = await refreshAccessToken()
        useBoundStore.setState((s) => ({ auth: { ...s.auth, token: access_token } }))
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        // Only a definitive 401 (refresh cookie actually invalid/expired) means the
        // user is really logged out. A 429/network/5xx here is transient — the
        // original request still fails, but wiping the session on top of that turned
        // one rate-limited request into a spurious full logout.
        if (isDefiniteAuthFailure(refreshError)) {
          useBoundStore.getState().auth.logout()
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)
