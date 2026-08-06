import { namespaceSlice, isFresh, getErrorDetail } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

export interface ExtractedFields {
  tier: string
  // Present on single receipts/bills; absent on statements (which carry `transactions`).
  confidence?: 'high' | 'medium' | 'low'
  merchant?: string | null
  merchant_id?: number | null
  date?: string | null
  total?: number | null
  line_items?: { description: string; amount: number }[] | null
  category_hint?: string | null
  category_id?: number | null
  // Statement mode (S4): the extracted transaction rows (preview count only here — the
  // full rows with dedup verdicts come from GET /documents/{id}/statement).
  kind?: string
  transactions?: { description: string; amount: number }[]
}

export interface PendingDocument {
  id: number
  kind: string
  mime_type: string
  status: string
  uploaded_at: string
  extracted_json: ExtractedFields | null
}

export interface FuzzyMatch {
  transaction_id: number
  date: string
  amount: number
  description: string
  merchant_name: string | null
  similarity: number
}

export interface DocumentReviewPayload {
  amount: number
  description: string
  transaction_type: 'income' | 'expense'
  account_id: number
  category_id?: number | null
  merchant_id?: number | null
  date: string
  notes?: string | null
  skip_dedup?: boolean
}

export interface DocumentReviewResult {
  status: 'created' | 'exact_duplicate' | 'fuzzy_duplicate'
  transaction_id: number | null
  fuzzy_matches: FuzzyMatch[]
}

// --- Statement mode (S4) ---
export interface StatementRow {
  row_index: number
  date: string | null
  description: string
  amount: number
  transaction_type: 'income' | 'expense'
  category_id: number | null
  category_hint: string | null
  dedup_status: 'exact' | 'fuzzy' | 'none'
}

export interface StatementReview {
  tier: string | null
  rows: StatementRow[]
}

export interface StatementImportRow {
  date: string
  description: string
  amount: number
  transaction_type: 'income' | 'expense'
  category_id?: number | null
  skip_dedup?: boolean
}

export interface StatementImportResult {
  imported: number
  skipped: number
}

export type DocumentsSlice = {
  documents: {
    pending: PendingDocument[]
    loading: boolean
    lastFetchedAt: number | null
    fetchPendingDocuments: (opts?: { force?: boolean }) => Promise<void>
    reviewDocument: (id: number, payload: DocumentReviewPayload) => Promise<DocumentReviewResult>
    rejectDocument: (id: number) => Promise<void>
    // W6: the auto-detect misclassification escape hatch — re-extracts the
    // already-uploaded file under the forced kind and replaces its queue entry in
    // place, so the review dialog re-renders with the corrected extraction.
    reclassifyDocument: (id: number, kind: 'receipt' | 'statement') => Promise<PendingDocument>
    fetchStatementRows: (id: number, accountId: number) => Promise<StatementReview>
    importStatement: (
      id: number,
      accountId: number,
      rows: StatementImportRow[],
    ) => Promise<StatementImportResult>
  }
}

// A document only leaves the pending list on a decisive outcome (created, exact
// duplicate that got auto-resolved, or reject) — a fuzzy-duplicate result still needs
// the user to merge/skip/keep-both, so it stays in the queue (mirrors the CSV import
// review queue's pending_review rows, U4).
export const createDocumentsSlice = namespaceSlice('documents', (set, get) => ({
  pending: [] as PendingDocument[],
  loading: true,
  lastFetchedAt: null as number | null,

  fetchPendingDocuments: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/documents/')
      set({ pending: res.data, lastFetchedAt: Date.now() })
    } finally {
      set({ loading: false })
    }
  },

  reviewDocument: async (
    id: number,
    payload: DocumentReviewPayload,
  ): Promise<DocumentReviewResult> => {
    try {
      const res = await api.post(`/api/documents/${id}/review`, payload)
      const result = res.data as DocumentReviewResult
      if (result.status !== 'fuzzy_duplicate') {
        const pending: PendingDocument[] = get().pending
        set({ pending: pending.filter((d) => d.id !== id) })
      }
      if (result.status === 'created') {
        toast.success('Transaction created')
      } else if (result.status === 'exact_duplicate') {
        toast.success('Already imported — nothing new to add')
      }
      // fuzzy_duplicate: no toast — the caller shows the match list inline instead.
      return result
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to save transaction'))
      throw error
    }
  },

  rejectDocument: async (id: number) => {
    const pending: PendingDocument[] = get().pending
    set({ pending: pending.filter((d) => d.id !== id) })
    try {
      await api.delete(`/api/documents/${id}`)
      toast.success('Receipt discarded')
    } catch (error) {
      set({ pending })
      toast.error(getErrorDetail(error, 'Failed to remove document'))
      throw error
    }
  },

  reclassifyDocument: async (id: number, kind: 'receipt' | 'statement') => {
    try {
      const res = await api.post(`/api/documents/${id}/reclassify`, null, { params: { kind } })
      const updated = res.data as PendingDocument
      const pending: PendingDocument[] = get().pending
      set({ pending: pending.map((d) => (d.id === id ? updated : d)) })
      return updated
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to re-classify document'))
      throw error
    }
  },

  fetchStatementRows: async (id: number, accountId: number): Promise<StatementReview> => {
    try {
      const res = await api.get(`/api/documents/${id}/statement`, {
        params: { account_id: accountId },
      })
      return res.data as StatementReview
    } catch (error) {
      toast.error(getErrorDetail(error, 'Could not read the statement'))
      throw error
    }
  },

  importStatement: async (
    id: number,
    accountId: number,
    rows: StatementImportRow[],
  ): Promise<StatementImportResult> => {
    try {
      const res = await api.post(`/api/documents/${id}/statement/import`, {
        account_id: accountId,
        rows,
      })
      // The statement is fully consumed on import (server marks it reviewed) — drop it
      // from the pending queue, same as a completed single-receipt review.
      const pending: PendingDocument[] = get().pending
      set({ pending: pending.filter((d) => d.id !== id) })
      const result = res.data as StatementImportResult
      toast.success(
        `Imported ${result.imported} transaction${result.imported === 1 ? '' : 's'}` +
          (result.skipped ? `, skipped ${result.skipped} duplicate(s)` : ''),
      )
      return result
    } catch (error) {
      toast.error(getErrorDetail(error, 'Failed to import statement'))
      throw error
    }
  },
}))

// --- Document review form state (merged from documentReviewFormSlice.ts) ---

const todayIso = () => new Date().toISOString().slice(0, 10)

export interface DocumentReviewFormState {
  imageUrl: string | null
  isPdf: boolean
  amount: string
  description: string
  transactionType: 'expense' | 'income'
  accountId: string
  categoryId: string
  date: string
  saving: boolean
  fuzzyMatches: FuzzyMatch[] | null
}

export interface DocumentReviewFormActions {
  initDocumentReviewForm: (
    ex: {
      total?: number | null
      merchant?: string | null
      category_id?: number | null
      date?: string | null
    } | null,
    defaultAccountId: string,
  ) => void
  setDocumentReviewImageUrl: (imageUrl: string | null) => void
  setDocumentReviewIsPdf: (isPdf: boolean) => void
  setDocumentReviewAmount: (amount: string) => void
  setDocumentReviewDescription: (description: string) => void
  setDocumentReviewTransactionType: (transactionType: 'expense' | 'income') => void
  setDocumentReviewAccountId: (accountId: string) => void
  setDocumentReviewCategoryId: (categoryId: string) => void
  setDocumentReviewDate: (date: string) => void
  setDocumentReviewSaving: (saving: boolean) => void
  setDocumentReviewFuzzyMatches: (fuzzyMatches: FuzzyMatch[] | null) => void
}

export type DocumentReviewFormSlice = {
  documentReviewForm: DocumentReviewFormState & DocumentReviewFormActions
}

const documentReviewFormInitialState: DocumentReviewFormState = {
  imageUrl: null,
  isPdf: false,
  amount: '',
  description: '',
  transactionType: 'expense',
  accountId: '',
  categoryId: '',
  date: todayIso(),
  saving: false,
  fuzzyMatches: null,
}

export const createDocumentReviewFormSlice = namespaceSlice('documentReviewForm', (set) => ({
  ...documentReviewFormInitialState,

  initDocumentReviewForm: (
    ex: {
      total?: number | null
      merchant?: string | null
      category_id?: number | null
      date?: string | null
    } | null,
    defaultAccountId: string,
  ) => {
    set({
      imageUrl: null,
      isPdf: false,
      amount: ex?.total != null ? String(ex.total) : '',
      description: ex?.merchant || '',
      transactionType: 'expense',
      accountId: defaultAccountId,
      categoryId: ex?.category_id ? String(ex.category_id) : '',
      date: ex?.date || todayIso(),
      saving: false,
      fuzzyMatches: null,
    })
  },

  setDocumentReviewImageUrl: (imageUrl: string | null) => set({ imageUrl }),
  setDocumentReviewIsPdf: (isPdf: boolean) => set({ isPdf }),
  setDocumentReviewAmount: (amount: string) => set({ amount }),
  setDocumentReviewDescription: (description: string) => set({ description }),
  setDocumentReviewTransactionType: (transactionType: 'expense' | 'income') =>
    set({ transactionType }),
  setDocumentReviewAccountId: (accountId: string) => set({ accountId }),
  setDocumentReviewCategoryId: (categoryId: string) => set({ categoryId }),
  setDocumentReviewDate: (date: string) => set({ date }),
  setDocumentReviewSaving: (saving: boolean) => set({ saving }),
  setDocumentReviewFuzzyMatches: (fuzzyMatches: FuzzyMatch[] | null) => set({ fuzzyMatches }),
}))

// --- Document upload/viewer dialog state (merged from documentDialogsSlice.ts) ---

// W6: one entry per file dropped in a single multi-file upload — tracked individually
// so one bad file (wrong type, oversize, a 4xx from the server) doesn't block or hide
// the others. `name`/`size` are kept (not the File object) purely for display in the
// queue UI after the upload finishes and the underlying File reference is no longer
// needed.
export interface DocumentUploadQueueItem {
  name: string
  size: number
  status: 'pending' | 'uploading' | 'done' | 'failed'
  error?: string
}

export interface DocumentUploadDialogState {
  dragActive: boolean
  queue: DocumentUploadQueueItem[]
}

export interface DocumentUploadDialogActions {
  setDocumentUploadDragActive: (dragActive: boolean) => void
  setDocumentUploadQueue: (queue: DocumentUploadQueueItem[]) => void
  updateDocumentUploadQueueItem: (index: number, patch: Partial<DocumentUploadQueueItem>) => void
  clearDocumentUploadQueue: () => void
}

export type DocumentUploadDialogSlice = {
  documentUploadDialog: DocumentUploadDialogState & DocumentUploadDialogActions
}

export const createDocumentUploadDialogSlice = namespaceSlice(
  'documentUploadDialog',
  (set, get) => ({
    dragActive: false,
    queue: [] as DocumentUploadQueueItem[],

    setDocumentUploadDragActive: (dragActive: boolean) => set({ dragActive }),
    setDocumentUploadQueue: (queue: DocumentUploadQueueItem[]) => set({ queue }),
    updateDocumentUploadQueueItem: (index: number, patch: Partial<DocumentUploadQueueItem>) => {
      const queue = [...get().queue]
      const current = queue[index]
      if (!current) return
      queue[index] = { ...current, ...patch }
      set({ queue })
    },
    clearDocumentUploadQueue: () => set({ queue: [] }),
  }),
)

export interface DocumentViewerDialogState {
  imageUrl: string | null
  isPdf: boolean
}

export interface DocumentViewerDialogActions {
  setDocumentViewerImageUrl: (imageUrl: string | null) => void
  setDocumentViewerIsPdf: (isPdf: boolean) => void
}

export type DocumentViewerDialogSlice = {
  documentViewerDialog: DocumentViewerDialogState & DocumentViewerDialogActions
}

export const createDocumentViewerDialogSlice = namespaceSlice('documentViewerDialog', (set) => ({
  imageUrl: null as string | null,
  isPdf: false,

  setDocumentViewerImageUrl: (imageUrl: string | null) => set({ imageUrl }),
  setDocumentViewerIsPdf: (isPdf: boolean) => set({ isPdf }),
}))

// --- Statement review state (merged from statementReviewSlice.ts) ---

export interface StatementReviewState {
  accountId: string
  rows: StatementRow[]
  checked: Record<number, boolean>
  tier: string | null
  loading: boolean
  saving: boolean
}

export interface StatementReviewActions {
  initStatementReview: (accountId: string) => void
  setStatementAccountId: (accountId: string) => void
  setStatementRows: (rows: StatementRow[]) => void
  setStatementChecked: (checked: Record<number, boolean>) => void
  toggleStatementRow: (rowIndex: number, value: boolean) => void
  setStatementTier: (tier: string | null) => void
  setStatementLoading: (loading: boolean) => void
  setStatementSaving: (saving: boolean) => void
}

export type StatementReviewSlice = {
  statementReview: StatementReviewState & StatementReviewActions
}

const statementReviewInitialState: StatementReviewState = {
  accountId: '',
  rows: [],
  checked: {},
  tier: null,
  loading: true,
  saving: false,
}

export const createStatementReviewSlice = namespaceSlice('statementReview', (set, get) => ({
  ...statementReviewInitialState,

  initStatementReview: (accountId: string) => {
    set({ ...statementReviewInitialState, accountId })
  },

  setStatementAccountId: (accountId: string) => set({ accountId }),
  setStatementRows: (rows: StatementRow[]) => set({ rows }),
  setStatementChecked: (checked: Record<number, boolean>) => set({ checked }),

  toggleStatementRow: (rowIndex: number, value: boolean) => {
    set({ checked: { ...get().checked, [rowIndex]: value } })
  },

  setStatementTier: (tier: string | null) => set({ tier }),
  setStatementLoading: (loading: boolean) => set({ loading }),
  setStatementSaving: (saving: boolean) => set({ saving }),
}))
