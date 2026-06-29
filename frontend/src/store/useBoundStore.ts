import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createAuthSlice } from './slices/authSlice.ts'
import { createUISlice } from './slices/uiSlice.ts'
import type { StoreState } from './types.ts'

export const useBoundStore = create<StoreState>()(
  devtools(
    immer((...a) => ({
      ...(createAuthSlice(...a) as unknown as StoreState),
      ...(createUISlice(...a) as unknown as StoreState),
    })),
    { name: 'My Financial Life' },
  ),
)
