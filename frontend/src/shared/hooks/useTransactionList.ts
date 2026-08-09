import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../store/useBoundStore.ts'
import type { Transaction } from '../../store/slices/transactionsSlice.ts'
import type { TransactionFilters } from './useTransactionFilters.ts'
import { useDebouncedValue } from './useDebouncedValue.ts'

// Shared between desktop/mobile Activity (rules/dry.md) — search/filter refetch,
// infinite scroll, and the optimistic mutations, one implementation for both trees.
export const useTransactionList = (filters: TransactionFilters) => {
  const {
    items,
    loading,
    loadingMore,
    hasMore,
    fetchTransactions,
    deleteTransaction,
    updateNotes,
    updateTransaction,
  } = useBoundStore(
    useShallow((s) => ({
      items: s.transactions.items,
      loading: s.transactions.loading,
      loadingMore: s.transactions.loadingMore,
      hasMore: s.transactions.hasMore,
      fetchTransactions: s.transactions.fetchTransactions,
      deleteTransaction: s.transactions.deleteTransaction,
      updateNotes: s.transactions.updateNotes,
      updateTransaction: s.transactions.updateTransaction,
    })),
  )
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { typeFilter, categoryFilter, merchantFilter, startDate, endDate } = filters
  // Same reason as the document library: the effect below depends on the query string,
  // so an un-debounced box issued one /api/transactions/ request per keystroke.
  const search = useDebouncedValue(filters.search)

  useEffect(() => {
    // force: true — this effect only re-runs because a filter value actually changed
    // (it's in the dependency array), so it must always hit the network. Without it,
    // clearing the search box back to "" looks identical to a plain unfiltered reset
    // (an empty string is falsy) and can get skipped by the 30s staleness gate that's
    // meant for Home's simple mount-only fetch, leaving stale filtered results on
    // screen until something else forces a refetch.
    fetchTransactions({
      reset: true,
      force: true,
      search,
      typeFilter,
      categoryFilter,
      merchantFilter,
      startDate,
      endDate,
    })
  }, [fetchTransactions, search, typeFilter, categoryFilter, merchantFilter, startDate, endDate])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          fetchTransactions({
            search,
            typeFilter,
            categoryFilter,
            merchantFilter,
            startDate,
            endDate,
          })
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [
    hasMore,
    loading,
    loadingMore,
    fetchTransactions,
    search,
    typeFilter,
    categoryFilter,
    merchantFilter,
    startDate,
    endDate,
  ])

  // updateTransaction now throws on failure (transactionsSlice.ts) so a caller mid-edit
  // knows to keep the dialog open instead of closing on a save that didn't happen —
  // swallow it here so callers can just `await` without a try/catch of their own.
  const saveTransaction = async (
    id: number,
    data: Partial<Omit<Transaction, 'id' | 'created_at'>>,
  ): Promise<boolean> => {
    try {
      await updateTransaction(id, data)
      return true
    } catch {
      return false
    }
  }

  const refetch = () =>
    fetchTransactions({
      reset: true,
      force: true,
      search,
      typeFilter,
      categoryFilter,
      merchantFilter,
      startDate,
      endDate,
    })

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    sentinelRef,
    deleteTransaction,
    updateNotes,
    saveTransaction,
    refetch,
  }
}
