import axios from 'axios'
import api from './client.ts'
import type { Profile } from '../types/user.ts'

// A 401 from /api/auth/refresh means the refresh cookie is genuinely invalid/expired —
// that's a real "you're logged out." Anything else (429 rate-limited, a network blip,
// a 5xx) is transient and says nothing about whether the session is valid. Both
// authSlice's verifyToken and the response interceptor's refresh-failure handler must
// use this same check before clearing a session — treating a transient error as a
// logout was a real bug: parallel fetches on page load could trip the backend's auth
// rate limit and every caller of refreshAccessToken() would kick the user to /login
// despite a perfectly valid cookie.
export const isDefiniteAuthFailure = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 401

export interface RefreshResponse {
  access_token: string
  user_id: number
  email: string
  is_admin: boolean
  profiles: Profile[]
}

// Single-flight token refresh: both the axios 401 interceptor (interceptors.ts) and
// the app-mount bootstrap (authSlice.ts's verifyToken) need to refresh the access
// token, and previously each called `/api/auth/refresh` independently. If the
// backend rotates a single-use refresh cookie on every call, two concurrent refreshes
// race — the loser gets a 401 on an already-consumed token and force-logs-out the
// user even though the winner's refresh just succeeded. Routing every caller through
// this one in-flight promise means only one network call happens per refresh cycle;
// concurrent callers all await the same result.
let refreshPromise: Promise<RefreshResponse> | null = null

export const refreshAccessToken = (): Promise<RefreshResponse> => {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/api/auth/refresh')
      .then((response) => response.data as RefreshResponse)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}
