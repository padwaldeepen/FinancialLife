import axios from 'axios'
import api from '../shared/api/client.ts'

// Shared staleness check for slice fetch actions: skip refetching if the last fetch
// landed within `thresholdMs` and the caller didn't force a refresh. Kills the loading
// flash on every navigation for data that hasn't gone stale (U3). One implementation,
// not reimplemented per slice (rules/dry.md).
export const isFresh = (lastFetchedAt: number | null, thresholdMs = 30_000): boolean =>
  lastFetchedAt !== null && Date.now() - lastFetchedAt < thresholdMs

// Pulls the backend's `{ detail: "..." }` error body out of an axios error, with a
// fallback for network errors / non-axios throws / a missing detail field. Centralizes
// a pattern that used to be hand-rolled (and inconsistently typed, often via `any`) at
// ~18 call sites across slices and components (rules/dry.md).
export const getErrorDetail = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail
    if (typeof detail === 'string' && detail) return detail
  }
  return fallback
}

// Same idea as getErrorDetail, but also handles FastAPI's 422 validation-error shape,
// where `detail` is an array of `{ msg, loc, type, input }` objects (distinct from a
// hand-raised HTTPException's plain-string detail) — joins their `msg` fields instead
// of rendering `[object Object]`.
export const getValidationErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (Array.isArray(detail)) {
      return detail
        .map((e) => (e as { msg?: string }).msg)
        .filter(Boolean)
        .join('; ')
    }
    if (typeof detail === 'string' && detail) return detail
  }
  return fallback
}

// Shared "mutate then refetch the whole collection" helper: several slices don't merge
// the mutation's response into local state, they just re-GET the collection endpoint
// and replace it wholesale. `transform` lets a caller reshape the raw response before
// it's set (e.g. categoriesSlice deriving `flat` from the refetched `tree`); without
// one, the response is set directly under `key`.
export const refetchCollection = async <T = unknown>(
  set: (partial: Record<string, unknown>) => void,
  url: string,
  key: string,
  transform?: (data: T) => Record<string, unknown>,
): Promise<void> => {
  const res = await api.get(url)
  const data = res.data as T
  set(transform ? transform(data) : { [key]: data })
}

// V5 (attempted and reverted, 2026-08-08): these `any`s were replaced with an
// `unknown`-based `SliceShape` generic. It typechecked here but cascaded ~30 errors
// across every slice — each one then had to narrow `unknown` back to its own state type
// at every `set`/`get`, which is strictly more casting than it removes.
//
// The looseness is inherent to the factory, not laziness: it is generic over every slice
// in the app and cannot know any individual slice's shape. Real per-slice type safety
// already exists one level up, in `StoreState` (types.ts), which is where components
// consume the store. Left as-is deliberately; the 8 lint warnings are the honest price.

export const namespaceSlice = <N extends string>(
  name: N,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  creator: (set: (partial: any) => void, get: () => any) => any,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (set: any, get: any, _api: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nsSet = (partial: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set((state: any) => ({
        [name]: { ...state[name], ...partial },
      }))
    }
    const nsGet = () => get()[name]

    const result = creator(nsSet, nsGet)

    return { [name]: result }
  }
}
