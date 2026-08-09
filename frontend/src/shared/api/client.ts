import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

const baseURL = import.meta.env.VITE_API_URL || undefined

const api = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Dedupe identical concurrent GETs (same url + params + active profile) into one
// network call. React 18 StrictMode double-invokes mount effects, and this app's
// slice fetch actions only guard against *sequential* re-fetches (via `isFresh`'s
// 30s window) — two overlapping calls in the same tick both read a stale
// `lastFetchedAt` before either finishes, so both fire. Sharing the in-flight
// promise here fixes it at the network layer instead of in every slice.
const inFlightGets = new Map<string, Promise<AxiosResponse>>()

// Profile id isn't in `config.headers` yet at this point (the request interceptor
// attaches it later, at dispatch time) — but switching profiles does a full page
// reload (see useProfileSwitch), so within one page instance every concurrent GET
// to the same url+params is necessarily for the same active profile already.
const originalGet = api.get.bind(api)
api.get = ((url: string, config?: AxiosRequestConfig) => {
  // `responseType` is part of the key: two concurrent GETs to the same url+params but
  // different response types are NOT interchangeable, and collapsing them would hand one
  // caller a parsed object where it expected a Blob. Latent today (only the document
  // download uses 'blob'), cheap to make impossible.
  const key = `${url}:${config?.responseType ?? 'json'}:${JSON.stringify(config?.params ?? {})}`

  // An aborted request must never be shared — the second caller would inherit the first
  // caller's cancellation.
  if (config?.signal) return originalGet(url, config)

  const existing = inFlightGets.get(key)
  if (existing) return existing

  const request = originalGet(url, config).finally(() => {
    inFlightGets.delete(key)
  })
  inFlightGets.set(key, request)
  return request
}) as typeof api.get

export default api
