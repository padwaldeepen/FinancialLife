import type { AuthSlice } from './slices/authSlice.ts'
import type { UISlice } from './slices/uiSlice.ts'
import type { AccountsSlice } from './slices/accountsSlice.ts'
import type { TransactionsSlice } from './slices/transactionsSlice.ts'
import type { GoalsSlice } from './slices/goalsSlice.ts'
import type { BillsSlice } from './slices/billsSlice.ts'
import type { MerchantsSlice } from './slices/merchantsSlice.ts'
import type { CategoriesSlice } from './slices/categoriesSlice.ts'
import type { ReportsSlice } from './slices/reportsSlice.ts'
import type { BudgetsSlice } from './slices/budgetsSlice.ts'
import type { RegisterFormSlice } from './slices/registerFormSlice.ts'
import type { LoginFormSlice } from './slices/loginFormSlice.ts'
import type { QuickAddModalSlice } from './slices/quickAddModalSlice.ts'
import type { ToastSlice } from './slices/toastSlice.ts'
import type { RecurringPageSlice } from './slices/recurringPageSlice.ts'
import type { RecurringInsightsSlice } from './slices/recurringInsightsSlice.ts'
import type { SafeToSpendSlice } from './slices/safeToSpendSlice.ts'
import type { AdviceSlice } from './slices/adviceSlice.ts'
import type { DocumentsSlice } from './slices/documentsSlice.ts'
import type { AdminSlice } from './slices/adminSlice.ts'

export type StoreState = AuthSlice &
  UISlice &
  AccountsSlice &
  TransactionsSlice &
  GoalsSlice &
  BillsSlice &
  MerchantsSlice &
  CategoriesSlice &
  ReportsSlice &
  BudgetsSlice &
  RegisterFormSlice &
  LoginFormSlice &
  QuickAddModalSlice &
  ToastSlice &
  RecurringPageSlice &
  RecurringInsightsSlice &
  SafeToSpendSlice &
  AdviceSlice &
  DocumentsSlice &
  AdminSlice
