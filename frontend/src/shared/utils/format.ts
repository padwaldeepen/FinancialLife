// One currency per screen, always — a profile is a sealed single-currency world
// (docs/architecture-and-goals.md "Country & currency rules"), so this never takes
// a "convert to" argument, only "which profile's currency am I displaying."
const CURRENCY_LOCALE: Record<string, string> = { USD: 'en-US', INR: 'en-IN', CAD: 'en-CA' }
const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', INR: '₹', CAD: 'C$' }

export const getCurrencySymbol = (currency: string): string => CURRENCY_SYMBOL[currency] ?? '$'

export const formatCurrency = (amount: number, currency: string): string => {
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US'
  const symbol = getCurrencySymbol(currency)
  const formatted = Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  // Negative money must LOOK negative — hiding the sign turns debt into assets
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

// A transaction date is a calendar day, not an instant — "7 Aug" means 7 Aug wherever
// you are. But `new Date('2026-08-07')` follows the ISO spec and parses a bare date as
// UTC midnight, which then renders as the 6th anywhere west of Greenwich (spotted on a
// scanned receipt: stored 2026-08-07, shown "Aug 6"). Build the date from its own
// components so it lands on local midnight and the day can't drift.
const parseCalendarDate = (dateStr: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return new Date(dateStr)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export const formatDate = (dateStr: string): string => {
  const d = parseCalendarDate(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// The inverse of parseCalendarDate: a local calendar day as YYYY-MM-DD.
// Deliberately not `toISOString().slice(0,10)`, which converts to UTC first and so
// hands back yesterday's date for anyone west of Greenwich.
export const toCalendarDateString = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Full date ("8/7/2026") for places that want the exact day rather than the
// Today/Yesterday shorthand. Shares parseCalendarDate so it can't drift either.
export const formatCalendarDate = (dateStr: string): string =>
  parseCalendarDate(dateStr).toLocaleDateString()

// E2: a refund is stored as an expense with a *negative* amount, so the sign — not the
// type — decides which way the money actually moved. The old `type === 'income' ? '+' : '-'`
// prefix, pasted at five render sites, printed a refund as "--$60.00" and coloured it red
// as though you had spent again.
export const isMoneyIn = (amount: number, type: string): boolean => type === 'income' || amount < 0

export const formatSignedAmount = (amount: number, type: string, currency: string): string =>
  `${isMoneyIn(amount, type) ? '+' : '-'}${formatCurrency(Math.abs(amount), currency)}`

export const getSignedAmountColor = (amount: number, type: string): string =>
  isMoneyIn(amount, type) ? 'var(--money-positive)' : 'var(--money-negative)'

export const getAmountColor = (type: string): string => {
  // Z1: go through the semantic tokens, not the raw Radix steps. The dark theme
  // overrides these to a higher-contrast step (raw step 11 measured 4.13:1 / 3.73:1
  // there, under the 4.5:1 AA floor) — hardcoding `--green-11` here would silently
  // bypass that fix, which is exactly what it did before.
  return type === 'income' ? 'var(--money-positive)' : 'var(--money-negative)'
}
