import { namespaceSlice } from '../namespaceSlice.ts'
import { isValidEmail } from '../../shared/utils/validators.ts'
import type { Country } from '../../shared/types/user.ts'

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
  formError?: string
}

export interface RegisterFormActions {
  setRegisterField: (
    field: keyof Omit<RegisterFormState, 'showPassword' | 'submitting' | 'errors'>,
    value: string,
  ) => void
  toggleRegisterShowPassword: () => void
  setRegisterSubmitting: (submitting: boolean) => void
  setRegisterErrors: (errors: RegisterFormErrors) => void
  setRegisterFormError: (message: string | undefined) => void
  clearRegisterFieldError: (field: keyof RegisterFormErrors) => void
  resetRegisterForm: () => void
  // Validation logic lives here, not duplicated in both Register.tsx trees (DRY —
  // rules/dry.md). Sets errors as a side effect and returns whether the form is valid.
  validateRegisterForm: () => boolean
}

export type RegisterFormSlice = {
  registerForm: RegisterFormState & RegisterFormActions
}

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
  formError: undefined,
}

export const createRegisterFormSlice = namespaceSlice('registerForm', (set, get) => ({
  ...initialState,

  setRegisterField: (
    field: keyof Omit<RegisterFormState, 'showPassword' | 'submitting' | 'errors'>,
    value: string,
  ) => {
    set({ [field]: value, formError: undefined })
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

  setRegisterFormError: (message: string | undefined) => {
    set({ formError: message })
  },

  clearRegisterFieldError: (field: keyof RegisterFormErrors) => {
    set({ errors: { ...get().errors, [field]: undefined } })
  },

  // Called on mount so a form left half-filled on a previous visit never leaks into
  // a fresh one — the one behavior a naive local-state-to-Zustand move would regress.
  resetRegisterForm: () => {
    set({ ...initialState })
  },

  validateRegisterForm: () => {
    const { fullName, username, email, password, confirmPassword } = get()
    const errors: RegisterFormErrors = {}
    if (!fullName) errors.fullName = 'Full name is required'
    else if (fullName.trim().length < 2) errors.fullName = 'Minimum 2 characters'
    if (!username) errors.username = 'Username is required'
    else if (username.trim().length < 3) errors.username = 'Minimum 3 characters'
    else if (!/^[a-zA-Z0-9_]+$/.test(username))
      errors.username = 'Letters, numbers, and underscores only'
    if (!email) errors.email = 'Email is required'
    else if (!isValidEmail(email)) errors.email = 'Invalid email'
    if (!password) errors.password = 'Password is required'
    else if (password.length < 8) errors.password = 'Minimum 8 characters'
    else if (!/[A-Z]/.test(password)) errors.password = 'Include at least one uppercase letter'
    else if (!/[0-9]/.test(password)) errors.password = 'Include at least one number'
    if (!confirmPassword) errors.confirmPassword = 'Please confirm your password'
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match'

    set({ errors })
    return Object.keys(errors).length === 0
  },
}))
