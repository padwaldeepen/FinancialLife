// How many times a bill on this frequency occurs per year, expressed as a ratio over
// 12 months — used to derive a monthly-equivalent cost. Integer-cents arithmetic
// throughout (never raw float dollars) so the per-row figures and their sum are
// Decimal-exact and hand-checkable against each other (docs/backlog.md U5).
const FREQUENCY_MONTHLY_RATIO: Record<string, { timesPerYear: number }> = {
  weekly: { timesPerYear: 52 },
  biweekly: { timesPerYear: 26 },
  monthly: { timesPerYear: 12 },
  quarterly: { timesPerYear: 4 },
  yearly: { timesPerYear: 1 },
}

export const toCents = (amount: number): number => Math.round(amount * 100)

// One bill's monthly-equivalent cost, in cents, rounded independently — this is the
// number displayed on that bill's row.
export const monthlyEquivalentCents = (amountDollars: number, frequency: string): number => {
  const ratio = FREQUENCY_MONTHLY_RATIO[frequency]
  if (!ratio) return toCents(amountDollars)
  return Math.round((toCents(amountDollars) * ratio.timesPerYear) / 12)
}

// The "total per month" headline is the sum of the already-rounded per-row cents
// above, not a fresh sum of the raw dollar amounts — so it always matches what you get
// by adding up the numbers actually shown on screen.
export const sumMonthlyEquivalentCents = (bills: { amount: number; frequency: string }[]): number =>
  bills.reduce((sum, b) => sum + monthlyEquivalentCents(b.amount, b.frequency), 0)

export const centsToDollars = (cents: number): number => cents / 100

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

// Shared by Recurring.tsx and BillDetail.tsx — was duplicated verbatim in both before
// U5 (rules/dry.md).
export const frequencyLabel = (frequency: string): string => FREQUENCY_LABEL[frequency] ?? frequency
