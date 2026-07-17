// One currency per screen, always — a profile is a sealed single-currency world
// (docs/architecture-and-goals.md "Country & currency rules"), so this never takes
// a "convert to" argument, only "which profile's currency am I displaying."
const CURRENCY_LOCALE: Record<string, string> = { USD: 'en-US', INR: 'en-IN', CAD: 'en-CA' }
const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', INR: '₹', CAD: 'C$' }

export const formatCurrency = (amount: number, currency: string): string => {
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US'
  const symbol = CURRENCY_SYMBOL[currency] ?? '$'
  const formatted = Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  // Negative money must LOOK negative — hiding the sign turns debt into assets
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

export const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const formatDateFull = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const getAmountColor = (type: string): string => {
  return type === 'income' ? 'var(--green-11)' : 'var(--red-11)'
}
