import { create } from 'zustand'
import { createAuthSlice } from './slices/authSlice.ts'
import type { StoreState } from './types.ts'

export const useBoundStore = create<StoreState>()((...a) => ({
  ...createAuthSlice(...a),
}))

export type { StoreState }
