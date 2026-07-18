// Shared staleness check for slice fetch actions: skip refetching if the last fetch
// landed within `thresholdMs` and the caller didn't force a refresh. Kills the loading
// flash on every navigation for data that hasn't gone stale (U3). One implementation,
// not reimplemented per slice (rules/dry.md).
export const isFresh = (lastFetchedAt: number | null, thresholdMs = 30_000): boolean =>
  lastFetchedAt !== null && Date.now() - lastFetchedAt < thresholdMs

export const namespaceSlice = <N extends string>(
  name: N,
  creator: (set: (partial: any) => void, get: () => any) => any,
) => {
  return (set: any, get: any, _api: any) => {
    const nsSet = (partial: any) => {
      set((state: any) => ({
        [name]: { ...state[name], ...partial },
      }))
    }
    const nsGet = () => get()[name]

    const result = creator(nsSet, nsGet)
    const stateFields: Record<string, unknown> = {}
    const actionFields: Record<string, (...args: any[]) => any> = {}

    for (const key of Object.keys(result)) {
      if (typeof result[key] === 'function') {
        actionFields[key] = result[key]
      } else {
        stateFields[key] = result[key]
      }
    }

    return { [name]: stateFields, ...actionFields }
  }
}
