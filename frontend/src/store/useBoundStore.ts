import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createAuthSlice } from './slices/authSlice.ts'
import { createUISlice } from './slices/uiSlice.ts'
import { createAccountsSlice } from './slices/accountsSlice.ts'
import { createTransactionsSlice } from './slices/transactionsSlice.ts'
import { createGoalsSlice } from './slices/goalsSlice.ts'
import { createBillsSlice } from './slices/billsSlice.ts'
import { createMerchantsSlice } from './slices/merchantsSlice.ts'
import { createCategoriesSlice } from './slices/categoriesSlice.ts'
import { createReportsSlice } from './slices/reportsSlice.ts'
import { createBudgetsSlice } from './slices/budgetsSlice.ts'
import { createRegisterFormSlice } from './slices/registerFormSlice.ts'
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
    })),
    { name: 'My Financial Life' },
  ),
)
