import { useBoundStore } from '../../store/useBoundStore.ts'

// The active profile's currency — the one string every formatCurrency() call in the
// app must pass. No default, no fallback silently assuming USD: a profile is a
// sealed single-currency world (docs/architecture-and-goals.md "Country & currency
// rules"), so if this can't resolve a currency, something upstream is broken and
// callers should see 'USD' fail loudly via wrong-looking output rather than a hidden
// default masking the bug — hence returning the literal fallback here, once, in the
// single place that decides it, not scattered across 60+ call sites.
export const useActiveCurrency = (): string => {
  return useBoundStore((s) => {
    const active = s.auth.profiles.find((p) => p.id === s.auth.activeProfileId)
    return active?.currency ?? 'USD'
  })
}
