import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../store/useBoundStore.ts'
import type { Account } from '../../store/slices/accountsSlice.ts'
import type { Transaction } from '../../store/slices/transactionsSlice.ts'
import type { UpcomingBill } from '../../store/slices/billsSlice.ts'

const CASH_TYPES = new Set(['checking', 'savings', 'cash'])

export interface HomeData {
  accounts: Account[]
  accountsLoading: boolean
  // "Total Balance" must never include what's owed on a credit account — that's debt,
  // not spendable money. Split instead of summed (U3).
  cashOnHand: number
  creditOwed: number
  recentTransactions: Transaction[]
  txLoading: boolean
  upcomingBills: UpcomingBill[]
  loading: boolean
  refresh: (opts?: { force?: boolean }) => Promise<void>
}

// Shared between desktop/mobile Home (rules/dry.md — business logic, not layout).
// Both fetch the same three slices, derive the same cash/credit split, and need the
// same "force past staleness" refresh (mobile's pull-to-refresh, the quick-add modal's
// post-save refresh) — one implementation, not two.
export const useHomeData = (): HomeData => {
  const {
    accounts,
    accountsLoading,
    fetchAccounts,
    transactions,
    txLoading,
    fetchTransactions,
    upcomingBills,
    fetchUpcomingBills,
  } = useBoundStore(
    useShallow((s) => ({
      accounts: s.accounts.items,
      accountsLoading: s.accounts.loading,
      fetchAccounts: s.accounts.fetchAccounts,
      transactions: s.transactions.items,
      txLoading: s.transactions.loading,
      fetchTransactions: s.transactions.fetchTransactions,
      upcomingBills: s.bills.upcoming,
      fetchUpcomingBills: s.bills.fetchUpcomingBills,
    })),
  )

  useEffect(() => {
    fetchAccounts()
    fetchTransactions({ reset: true })
    fetchUpcomingBills()
  }, [fetchAccounts, fetchTransactions, fetchUpcomingBills])

  const cashOnHand = accounts
    .filter((a) => CASH_TYPES.has(a.type))
    .reduce((sum, a) => sum + a.balance, 0)
  // Account balance is computed backend-side as income - expense (account_service.
  // get_account_balance) uniformly across types — for a credit account, charges are
  // 'expense' and payments are 'income', so balance goes NEGATIVE as debt accrues.
  // Negate it here so "Credit owed" reads as the positive amount actually owed.
  const creditOwed = -accounts
    .filter((a) => a.type === 'credit')
    .reduce((sum, a) => sum + a.balance, 0)

  const refresh = async (opts?: { force?: boolean }) => {
    await Promise.all([
      fetchAccounts({ force: opts?.force }),
      fetchTransactions({ reset: true, force: opts?.force }),
      fetchUpcomingBills(30, { force: opts?.force }),
    ])
  }

  return {
    accounts,
    accountsLoading,
    cashOnHand,
    creditOwed,
    recentTransactions: transactions.slice(0, 5),
    txLoading,
    upcomingBills,
    loading: accountsLoading || txLoading,
    refresh,
  }
}
