import { namespaceSlice } from '../namespaceSlice.ts'

export type UISlice = {
  ui: {
    addModalOpen: boolean
    // Mobile-only (U8) — the bottom sheet the center tab button opens, offering
    // Type/Scan. Lives here rather than a one-off local useState so it follows the
    // same open/close pattern as addModalOpen instead of duplicating ad-hoc state.
    captureSheetOpen: boolean
  }
  openAddModal: () => void
  closeAddModal: () => void
  openCaptureSheet: () => void
  closeCaptureSheet: () => void
}

export const createUISlice = namespaceSlice('ui', (set) => ({
  addModalOpen: false,
  captureSheetOpen: false,

  openAddModal: () => set({ addModalOpen: true }),

  closeAddModal: () => set({ addModalOpen: false }),

  openCaptureSheet: () => set({ captureSheetOpen: true }),

  closeCaptureSheet: () => set({ captureSheetOpen: false }),
}))
