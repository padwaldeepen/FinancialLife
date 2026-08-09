import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'

// transactionsSlice's `selectedIds` is a Set<number> — immer can't finalize a Set
// unless this plugin is enabled, and silently throws on every update that touches it.
enableMapSet()
import { createAuthSlice } from './slices/authSlice.ts'
import { createUISlice } from './slices/uiSlice.ts'
import { createAccountsSlice, createAccountFormSlice } from './slices/accountsSlice.ts'
import {
  createTransactionsSlice,
  createTransactionEditFormSlice,
  createActivityPageSlice,
} from './slices/transactionsSlice.ts'
import { createGoalsSlice, createGoalsFormSlice } from './slices/goalsSlice.ts'
import { createBillsSlice } from './slices/billsSlice.ts'
import { createMerchantsSlice, createMerchantsPageSlice } from './slices/merchantsSlice.ts'
import { createCategoriesSlice, createCategoriesFormSlice } from './slices/categoriesSlice.ts'
import {
  createReportsSlice,
  createAnnualTimelineSlice,
  createInsightsPeriodSlice,
  createHomeRefreshSlice,
} from './slices/reportsSlice.ts'
import { createBudgetsSlice, createBudgetFormSlice } from './slices/budgetsSlice.ts'
import { createRegisterFormSlice } from './slices/registerFormSlice.ts'
import { createLoginFormSlice } from './slices/loginFormSlice.ts'
import { createQuickAddModalSlice } from './slices/quickAddModalSlice.ts'
import { createToastSlice } from './slices/toastSlice.ts'
import { createRecurringPageSlice } from './slices/recurringPageSlice.ts'
import { createRecurringInsightsSlice } from './slices/recurringInsightsSlice.ts'
import { createSafeToSpendSlice, createNetWorthSlice } from './slices/safeToSpendSlice.ts'
import { createAdviceSlice } from './slices/adviceSlice.ts'
import {
  createDocumentsSlice,
  createDocumentReviewFormSlice,
  createDocumentUploadDialogSlice,
  createDocumentViewerDialogSlice,
  createDocumentLibrarySlice,
  createStatementReviewSlice,
} from './slices/documentsSlice.ts'
import { createAdminSlice, createAdminFormSlice } from './slices/adminSlice.ts'
import { createChatSlice } from './slices/chatSlice.ts'
import type { StoreState } from './types.ts'

export const useBoundStore = create<StoreState>()(
  devtools(
    immer((...a) => ({
      ...(createAuthSlice(...a) as unknown as StoreState),
      ...(createUISlice(...a) as unknown as StoreState),
      ...(createAccountsSlice(...a) as unknown as StoreState),
      ...(createTransactionsSlice(...a) as unknown as StoreState),
      ...(createGoalsSlice(...a) as unknown as StoreState),
      ...(createBillsSlice(...a) as unknown as StoreState),
      ...(createMerchantsSlice(...a) as unknown as StoreState),
      ...(createCategoriesSlice(...a) as unknown as StoreState),
      ...(createReportsSlice(...a) as unknown as StoreState),
      ...(createBudgetsSlice(...a) as unknown as StoreState),
      ...(createRegisterFormSlice(...a) as unknown as StoreState),
      ...(createLoginFormSlice(...a) as unknown as StoreState),
      ...(createQuickAddModalSlice(...a) as unknown as StoreState),
      ...(createToastSlice(...a) as unknown as StoreState),
      ...(createRecurringPageSlice(...a) as unknown as StoreState),
      ...(createRecurringInsightsSlice(...a) as unknown as StoreState),
      ...(createSafeToSpendSlice(...a) as unknown as StoreState),
      ...(createNetWorthSlice(...a) as unknown as StoreState),
      ...(createAdviceSlice(...a) as unknown as StoreState),
      ...(createDocumentsSlice(...a) as unknown as StoreState),
      ...(createAdminSlice(...a) as unknown as StoreState),
      ...(createAccountFormSlice(...a) as unknown as StoreState),
      ...(createBudgetFormSlice(...a) as unknown as StoreState),
      ...(createGoalsFormSlice(...a) as unknown as StoreState),
      ...(createCategoriesFormSlice(...a) as unknown as StoreState),
      ...(createMerchantsPageSlice(...a) as unknown as StoreState),
      ...(createAdminFormSlice(...a) as unknown as StoreState),
      ...(createActivityPageSlice(...a) as unknown as StoreState),
      ...(createTransactionEditFormSlice(...a) as unknown as StoreState),
      ...(createStatementReviewSlice(...a) as unknown as StoreState),
      ...(createDocumentReviewFormSlice(...a) as unknown as StoreState),
      ...(createDocumentUploadDialogSlice(...a) as unknown as StoreState),
      ...(createDocumentViewerDialogSlice(...a) as unknown as StoreState),
      ...(createDocumentLibrarySlice(...a) as unknown as StoreState),
      ...(createAnnualTimelineSlice(...a) as unknown as StoreState),
      ...(createInsightsPeriodSlice(...a) as unknown as StoreState),
      ...(createChatSlice(...a) as unknown as StoreState),
      ...(createHomeRefreshSlice(...a) as unknown as StoreState),
    })),
    { name: 'My Financial Life' },
  ),
)
