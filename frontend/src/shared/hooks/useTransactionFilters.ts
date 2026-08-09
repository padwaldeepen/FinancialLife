import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../store/useBoundStore.ts'
import { toCalendarDateString } from '../utils/format.ts'

export interface TransactionFilters {
  search: string
  typeFilter: string
  categoryFilter: string
  merchantFilter: string
  datePreset: DatePreset
  startDate: string
  endDate: string
}

export type DatePreset = '' | 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'custom'

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  '': 'All time',
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-3-months': 'Last 3 months',
  'this-year': 'This year',
  custom: 'Custom range…',
}

// The ranges a person actually asks for when reviewing spending. Answering "what did I
// spend this month" used to mean hand-typing two boundary dates into a pair of bare
// browser date fields; these cover the common cases in one click and leave the raw
// inputs for the genuinely arbitrary range.
const presetRange = (preset: DatePreset): { start: string; end: string } | null => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (preset) {
    case 'this-month':
      return {
        start: toCalendarDateString(new Date(y, m, 1)),
        end: toCalendarDateString(new Date(y, m + 1, 0)),
      }
    case 'last-month':
      return {
        start: toCalendarDateString(new Date(y, m - 1, 1)),
        end: toCalendarDateString(new Date(y, m, 0)),
      }
    case 'last-3-months':
      return {
        start: toCalendarDateString(new Date(y, m - 2, 1)),
        end: toCalendarDateString(new Date(y, m + 1, 0)),
      }
    case 'this-year':
      return {
        start: toCalendarDateString(new Date(y, 0, 1)),
        end: toCalendarDateString(new Date(y, 11, 31)),
      }
    default:
      // '' clears the range; 'custom' keeps whatever the user typed.
      return null
  }
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
  const [datePreset, setDatePresetRaw] = useState<DatePreset>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const setDatePreset = (preset: DatePreset) => {
    setDatePresetRaw(preset)
    const range = presetRange(preset)
    if (preset !== 'custom') {
      setStartDate(range?.start ?? '')
      setEndDate(range?.end ?? '')
    }
  }

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
    datePreset,
    startDate,
    endDate,
  }

  // Drives the "no results" vs "no data" empty state — see Activity's comment there.
  const filtersActive = Boolean(
    search || typeFilter || categoryFilter || merchantFilter || startDate || endDate,
  )

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('')
    setCategoryFilter('')
    setMerchantFilter('')
    setDatePresetRaw('')
    setStartDate('')
    setEndDate('')
  }

  return {
    filters,
    filtersActive,
    clearFilters,
    setDatePreset,
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
