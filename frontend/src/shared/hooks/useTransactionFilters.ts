import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../store/useBoundStore.ts'

export interface TransactionFilters {
  search: string
  typeFilter: string
  categoryFilter: string
  merchantFilter: string
  startDate: string
  endDate: string
}

// Shared between desktop/mobile Activity (rules/dry.md). Also fixes a real bug found
// while extracting this: Activity used to read its category/merchant filter options
// from `transactionsSlice`'s own duplicate `fetchTxFilters()` call, which cast the
// categories endpoint's nested tree response straight to a flat list — subcategories
// never showed up in the filter dropdown. Reading `categoriesSlice.flat` (already
// correctly flattened for the Categories page) fixes that for free (U4).
export const useTransactionFilters = () => {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [merchantFilter, setMerchantFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { categories, merchants, fetchCategories, fetchMerchants } = useBoundStore(
    useShallow((s) => ({
      categories: s.categories.flat,
      merchants: s.merchants.items,
      fetchCategories: s.categories.fetchCategories,
      fetchMerchants: s.merchants.fetchMerchants,
    })),
  )

  useEffect(() => {
    fetchCategories()
    fetchMerchants()
  }, [fetchCategories, fetchMerchants])

  const filters: TransactionFilters = {
    search,
    typeFilter,
    categoryFilter,
    merchantFilter,
    startDate,
    endDate,
  }

  return {
    filters,
    setSearch,
    setTypeFilter,
    setCategoryFilter,
    setMerchantFilter,
    setStartDate,
    setEndDate,
    categories,
    merchants,
  }
}
