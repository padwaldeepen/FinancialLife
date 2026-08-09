import { useEffect, useState } from 'react'

/**
 * The value, but only after it has stopped changing for `delayMs`.
 *
 * Search boxes in this app feed straight into a store fetch whose effect depends on the
 * query string, so every keystroke was one HTTP request: typing "statement" fired nine.
 * The api client's in-flight dedupe doesn't help — each keystroke is a *different* query
 * and therefore a different key — and the document-library query is the expensive one.
 *
 * Deliberately debouncing the value rather than the fetch: the input stays fully
 * controlled and responsive, and only the derived query lags.
 */
export const useDebouncedValue = <T>(value: T, delayMs = 300): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
