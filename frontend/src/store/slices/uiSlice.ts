import { namespaceSlice } from '../namespaceSlice.ts'

export type UISlice = {
  ui: {
    addModalOpen: boolean
  }
  openAddModal: () => void
  closeAddModal: () => void
}

export const createUISlice = namespaceSlice('ui', (set) => ({
  addModalOpen: false,

  openAddModal: () => set({ addModalOpen: true }),

  closeAddModal: () => set({ addModalOpen: false }),
}))
