import { namespaceSlice } from '../namespaceSlice.ts'
import { isValidEmail } from '../../shared/utils/validators.ts'

export interface LoginFormErrors {
  email?: string
  password?: string
}

export interface LoginFormState {
  email: string
  password: string
  showPassword: boolean
  submitting: boolean
  errors: LoginFormErrors
  formError?: string
}

export interface LoginFormActions {
  setLoginField: (field: 'email' | 'password', value: string) => void
  toggleLoginShowPassword: () => void
  setLoginSubmitting: (submitting: boolean) => void
  clearLoginFieldError: (field: keyof LoginFormErrors) => void
  setLoginFormError: (message: string | undefined) => void
  resetLoginForm: () => void
  validateLoginForm: () => boolean
}

export type LoginFormSlice = {
  loginForm: LoginFormState
} & LoginFormActions

const initialState: LoginFormState = {
  email: '',
  password: '',
  showPassword: false,
  submitting: false,
  errors: {},
  formError: undefined,
}

export const createLoginFormSlice = namespaceSlice('loginForm', (set, get) => ({
  ...initialState,

  setLoginField: (field: 'email' | 'password', value: string) => {
    set({ [field]: value, formError: undefined })
  },

  toggleLoginShowPassword: () => {
    set({ showPassword: !get().showPassword })
  },

  setLoginSubmitting: (submitting: boolean) => {
    set({ submitting })
  },

  clearLoginFieldError: (field: keyof LoginFormErrors) => {
    set({ errors: { ...get().errors, [field]: undefined } })
  },

  setLoginFormError: (message: string | undefined) => {
    set({ formError: message })
  },

  // Called on mount so a form left half-filled on a previous visit never leaks into
  // a fresh one (same rule as registerFormSlice — rules/dry.md).
  resetLoginForm: () => {
    set({ ...initialState })
  },

  validateLoginForm: () => {
    const { email, password } = get()
    const errors: LoginFormErrors = {}
    if (!email) errors.email = 'Email is required'
    else if (!isValidEmail(email)) errors.email = 'Invalid email'
    if (!password) errors.password = 'Password is required'
    else if (password.length < 6) errors.password = 'Minimum 6 characters'

    set({ errors })
    return Object.keys(errors).length === 0
  },
}))
