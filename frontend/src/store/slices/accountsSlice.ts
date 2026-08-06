import { namespaceSlice, isFresh, getErrorDetail } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

export interface Account {
  id: number
  name: string
  type: string
  currency: string
  balance: number
  is_active: boolean
  sort_order: number
}

export type AccountsSlice = {
  accounts: {
    items: Account[]
    loading: boolean
    lastFetchedAt: number | null
    fetchAccounts: (opts?: { force?: boolean }) => Promise<void>
    createAccount: (data: { name: string; type: string; currency?: string }) => Promise<Account>
    updateAccount: (
      id: number,
      data: { name?: string; type?: string; currency?: string; is_active?: boolean },
    ) => Promise<void>
    deleteAccount: (id: number) => Promise<void>
  }
}

export const createAccountsSlice = namespaceSlice('accounts', (set, get) => ({
  items: [] as Account[],
  loading: true,
  lastFetchedAt: null as number | null,

  fetchAccounts: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/accounts/')
      set({ items: res.data, lastFetchedAt: Date.now() })
    } finally {
      set({ loading: false })
    }
  },

  createAccount: async (data: { name: string; type: string; currency?: string }) => {
    try {
      const res = await api.post('/api/accounts/', data)
      const account = res.data as Account
      const items: Account[] = get().items
      set({ items: [...items, account] })
      toast.success('Account created')
      return account
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to save account'))
      throw error
    }
  },

  updateAccount: async (
    id: number,
    data: { name?: string; type?: string; currency?: string; is_active?: boolean },
  ) => {
    try {
      const res = await api.put(`/api/accounts/${id}`, data)
      const updated = res.data as Account
      const items: Account[] = get().items
      set({ items: items.map((a) => (a.id === id ? updated : a)) })
      toast.success('Account updated')
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to save account'))
      throw error
    }
  },

  deleteAccount: async (id: number) => {
    const items: Account[] = get().items
    set({ items: items.filter((a) => a.id !== id) })
    try {
      await api.delete(`/api/accounts/${id}`)
      toast.success('Account deleted')
    } catch (error) {
      set({ items })
      toast.error(getErrorDetail(error, 'Failed to delete account'))
      throw error
    }
  },
}))

// --- Account form/dialog state (merged from accountFormSlice.ts) ---

export interface AccountFormFields {
  name: string
  type: string
  currency: string
}

export interface AccountFormState {
  dialogOpen: boolean
  editingId: number | null
  form: AccountFormFields
  saving: boolean
  deleteId: number | null
  deleteName: string
}

export interface AccountFormActions {
  openAccountCreate: () => void
  openAccountEdit: (account: { id: number; name: string; type: string; currency: string }) => void
  setAccountDialogOpen: (open: boolean) => void
  setAccountFormField: (field: keyof AccountFormFields, value: string) => void
  setAccountSaving: (saving: boolean) => void
  startAccountDelete: (id: number, name: string) => void
  cancelAccountDelete: () => void
}

export type AccountFormSlice = {
  accountForm: AccountFormState & AccountFormActions
}

const defaultForm = (): AccountFormFields => ({ name: '', type: 'checking', currency: 'USD' })

const accountFormInitialState: AccountFormState = {
  dialogOpen: false,
  editingId: null,
  form: defaultForm(),
  saving: false,
  deleteId: null,
  deleteName: '',
}

export const createAccountFormSlice = namespaceSlice('accountForm', (set, get) => ({
  ...accountFormInitialState,

  openAccountCreate: () => {
    set({ editingId: null, form: defaultForm(), dialogOpen: true })
  },

  openAccountEdit: (account: { id: number; name: string; type: string; currency: string }) => {
    set({
      editingId: account.id,
      form: { name: account.name, type: account.type, currency: account.currency },
      dialogOpen: true,
    })
  },

  setAccountDialogOpen: (open: boolean) => {
    set({ dialogOpen: open })
  },

  setAccountFormField: (field: keyof AccountFormFields, value: string) => {
    set({ form: { ...get().form, [field]: value } })
  },

  setAccountSaving: (saving: boolean) => {
    set({ saving })
  },

  startAccountDelete: (id: number, name: string) => {
    set({ deleteId: id, deleteName: name })
  },

  cancelAccountDelete: () => {
    set({ deleteId: null, deleteName: '' })
  },
}))
