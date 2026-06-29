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
