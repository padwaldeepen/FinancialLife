import type { AuthSlice } from './slices/authSlice.ts'
import type { UISlice } from './slices/uiSlice.ts'
import type { AccountsSlice, AccountFormSlice } from './slices/accountsSlice.ts'
import type {
  TransactionsSlice,
  TransactionEditFormSlice,
  ActivityPageSlice,
} from './slices/transactionsSlice.ts'
import type { GoalsSlice, GoalsFormSlice } from './slices/goalsSlice.ts'
import type { BillsSlice } from './slices/billsSlice.ts'
import type { MerchantsSlice, MerchantsPageSlice } from './slices/merchantsSlice.ts'
import type { CategoriesSlice, CategoriesFormSlice } from './slices/categoriesSlice.ts'
import type {
  ReportsSlice,
  AnnualTimelineSlice,
  InsightsPeriodSlice,
  HomeRefreshSlice,
} from './slices/reportsSlice.ts'
import type { BudgetsSlice, BudgetFormSlice } from './slices/budgetsSlice.ts'
import type { RegisterFormSlice } from './slices/registerFormSlice.ts'
import type { LoginFormSlice } from './slices/loginFormSlice.ts'
import type { QuickAddModalSlice } from './slices/quickAddModalSlice.ts'
import type { ToastSlice } from './slices/toastSlice.ts'
import type { RecurringPageSlice } from './slices/recurringPageSlice.ts'
import type { RecurringInsightsSlice } from './slices/recurringInsightsSlice.ts'
import type { SafeToSpendSlice } from './slices/safeToSpendSlice.ts'
import type { AdviceSlice } from './slices/adviceSlice.ts'
import type {
  DocumentsSlice,
  DocumentReviewFormSlice,
  DocumentUploadDialogSlice,
  DocumentViewerDialogSlice,
  StatementReviewSlice,
} from './slices/documentsSlice.ts'
import type { AdminSlice, AdminFormSlice } from './slices/adminSlice.ts'
import type { ChatSlice } from './slices/chatSlice.ts'

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
  AdminSlice &
  AccountFormSlice &
  BudgetFormSlice &
  GoalsFormSlice &
  CategoriesFormSlice &
  MerchantsPageSlice &
  AdminFormSlice &
  ActivityPageSlice &
  TransactionEditFormSlice &
  StatementReviewSlice &
  DocumentReviewFormSlice &
  DocumentUploadDialogSlice &
  DocumentViewerDialogSlice &
  AnnualTimelineSlice &
  InsightsPeriodSlice &
  ChatSlice &
  HomeRefreshSlice
