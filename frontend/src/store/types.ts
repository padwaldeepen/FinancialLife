import type { AuthSlice } from './slices/authSlice.ts'
import type { UISlice } from './slices/uiSlice.ts'

export type StoreState = AuthSlice & UISlice
