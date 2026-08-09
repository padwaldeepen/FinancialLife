import { useBoundStore } from './useBoundStore.ts'

/**
 * Refresh every view of the money after a write.
 *
 * A single transaction touches five independent slices — the account balance, Activity's
 * list, Home's recent list, upcoming bills, the reports totals and the safe-to-spend
 * forecast — and each caches on a 30s staleness window (U3), so without an explicit
 * force they stay stale until some unrelated navigation happens to refetch them.
 *
 * Six call sites did this by hand and **none of them agreed**: quick-add refreshed bills,
 * document review didn't, the statement importer refreshed neither bills nor
 * safe-to-spend. So paying a bill by scanning its receipt left "Upcoming Bills" showing
 * it as still due. One list, one behaviour.
 *
 * Deliberately a plain function over `getState()` rather than a slice action: it spans
 * namespaces, and inside a slice creator `get()` only sees that slice's own state
 * (rules/zustand.md).
 */
export const refreshAfterMoneyChange = (): void => {
  const s = useBoundStore.getState()
  s.accounts.fetchAccounts({ force: true })
  // Replay the filters Activity is currently showing. Passing no filters here refetched
  // the *unfiltered* feed into a filtered view — the list silently stopped matching its
  // own filter bar, and nothing re-applied it because useTransactionList's effect only
  // re-runs when a filter value changes.
  s.transactions.fetchTransactions({
    ...s.transactions.lastQuery,
    reset: true,
    force: true,
    mutated: true,
  })
  s.bills.fetchUpcomingBills(30, { force: true })
  s.reports.fetchReports()
  s.safeToSpend.fetchSafeToSpend({ force: true })
}
