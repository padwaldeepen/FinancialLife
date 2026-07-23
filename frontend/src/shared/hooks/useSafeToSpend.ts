import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../store/useBoundStore.ts'
import { formatCurrency } from '../utils/format.ts'

export interface SafeToSpendView {
  loading: boolean
  insufficientData: boolean
  amount: number | null
  // "next paycheck in N days, $X in bills before then" (I5) — null when there's no
  // detected payday to anchor the sentence to (irregular/undetected income), not a
  // fabricated one.
  subLine: string | null
}

// Shared between desktop/mobile Home (rules/dry.md) — same fetch, same sub-line
// wording, only the card markup differs per tree.
export const useSafeToSpend = (currency: string): SafeToSpendView => {
  const { data, loading, fetchSafeToSpend } = useBoundStore(
    useShallow((s) => ({
      data: s.safeToSpend.data,
      loading: s.safeToSpend.loading,
      fetchSafeToSpend: s.fetchSafeToSpend,
    })),
  )

  useEffect(() => {
    fetchSafeToSpend()
  }, [fetchSafeToSpend])

  if (loading) {
    return { loading: true, insufficientData: false, amount: null, subLine: null }
  }
  if (!data || data.insufficient_data) {
    return { loading: false, insufficientData: true, amount: null, subLine: null }
  }

  let subLine: string | null = null
  if (data.days_until_payday !== null) {
    const dayWord = data.days_until_payday === 1 ? 'day' : 'days'
    subLine = `Next paycheck in ${data.days_until_payday} ${dayWord}, ${formatCurrency(data.bills_before_payday, currency)} in bills before then`
  }

  return { loading: false, insufficientData: false, amount: data.safe_to_spend, subLine }
}
