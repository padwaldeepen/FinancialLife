import type { AuthSlice } from './slices/authSlice.ts'
import type { UISlice } from './slices/uiSlice.ts'
import type { AccountsSlice } from './slices/accountsSlice.ts'
import type { TransactionsSlice } from './slices/transactionsSlice.ts'
import type { GoalsSlice } from './slices/goalsSlice.ts'
import type { BillsSlice } from './slices/billsSlice.ts'
import type { MerchantsSlice } from './slices/merchantsSlice.ts'
import type { CategoriesSlice } from './slices/categoriesSlice.ts'
import type { ReportsSlice } from './slices/reportsSlice.ts'

export type StoreState = AuthSlice &
  UISlice &
  AccountsSlice &
  TransactionsSlice &
  GoalsSlice &
  BillsSlice &
  MerchantsSlice &
  CategoriesSlice &
  ReportsSlice
