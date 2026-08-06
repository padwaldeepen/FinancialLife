import { namespaceSlice } from '../namespaceSlice.ts'

export type ToastVariant = 'success' | 'error'

export interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

export type ToastSlice = {
  toasts: {
    items: ToastItem[]
    pushToast: (message: string, variant: ToastVariant) => void
    dismissToast: (id: number) => void
  }
}

let nextId = 1

// Just a queue — auto-dismiss timing (with pause-on-hover/focus) is Radix Toast's
// own job (ToastHost.tsx's `Toast.Provider duration`), not reimplemented here.
export const createToastSlice = namespaceSlice('toasts', (set, get) => ({
  items: [] as ToastItem[],

  pushToast: (message: string, variant: ToastVariant) => {
    set({ items: [...get().items, { id: nextId++, message, variant }] })
  },

  dismissToast: (id: number) => {
    set({ items: get().items.filter((t: ToastItem) => t.id !== id) })
  },
}))
