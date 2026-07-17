import { namespaceSlice } from '../namespaceSlice.ts'
import type { Country } from '../../auth/types.ts'

export interface RegisterFormErrors {
  fullName?: string
  username?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export interface RegisterFormState {
  fullName: string
  username: string
  email: string
  password: string
  confirmPassword: string
  country: Country
  showPassword: boolean
  submitting: boolean
  errors: RegisterFormErrors
}

export interface RegisterFormActions {
  setRegisterField: (
    field: keyof Omit<RegisterFormState, 'showPassword' | 'submitting' | 'errors'>,
    value: string,
  ) => void
  toggleRegisterShowPassword: () => void
  setRegisterSubmitting: (submitting: boolean) => void
  setRegisterErrors: (errors: RegisterFormErrors) => void
  clearRegisterFieldError: (field: keyof RegisterFormErrors) => void
  resetRegisterForm: () => void
}

export type RegisterFormSlice = {
  registerForm: RegisterFormState
} & RegisterFormActions

const initialState: RegisterFormState = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  country: 'US',
  showPassword: false,
  submitting: false,
  errors: {},
}

export const createRegisterFormSlice = namespaceSlice('registerForm', (set, get) => ({
  ...initialState,

  setRegisterField: (
    field: keyof Omit<RegisterFormState, 'showPassword' | 'submitting' | 'errors'>,
    value: string,
  ) => {
    set({ [field]: value })
  },

  toggleRegisterShowPassword: () => {
    set({ showPassword: !get().showPassword })
  },

  setRegisterSubmitting: (submitting: boolean) => {
    set({ submitting })
  },

  setRegisterErrors: (errors: RegisterFormErrors) => {
    set({ errors })
  },

  clearRegisterFieldError: (field: keyof RegisterFormErrors) => {
    set({ errors: { ...get().errors, [field]: undefined } })
  },

  // Called on mount so a form left half-filled on a previous visit never leaks into
  // a fresh one — the one behavior a naive local-state-to-Zustand move would regress.
  resetRegisterForm: () => {
    set({ ...initialState })
  },
}))
