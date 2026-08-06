import { namespaceSlice } from '../namespaceSlice.ts'

export type UISlice = {
  ui: {
    addModalOpen: boolean
    // Mobile-only (U8) — the bottom sheet the center tab button opens, offering
    // Type/Scan. Lives here rather than a one-off local useState so it follows the
    // same open/close pattern as addModalOpen instead of duplicating ad-hoc state.
    captureSheetOpen: boolean
    // Mobile-only (S6) — the id of the just-scanned document being reviewed, or null.
    // Global (not local to CaptureSheet) so both the scan flow and the "pending
    // receipts" entry point on Activity can open the same review sheet.
    scanReviewDocId: number | null
    openAddModal: () => void
    closeAddModal: () => void
    openCaptureSheet: () => void
    closeCaptureSheet: () => void
    openScanReview: (documentId: number) => void
    closeScanReview: () => void
  }
}

export const createUISlice = namespaceSlice('ui', (set) => ({
  addModalOpen: false,
  captureSheetOpen: false,
  scanReviewDocId: null as number | null,

  openAddModal: () => set({ addModalOpen: true }),

  closeAddModal: () => set({ addModalOpen: false }),

  openCaptureSheet: () => set({ captureSheetOpen: true }),

  closeCaptureSheet: () => set({ captureSheetOpen: false }),

  openScanReview: (documentId: number) => set({ scanReviewDocId: documentId }),

  closeScanReview: () => set({ scanReviewDocId: null }),
}))
