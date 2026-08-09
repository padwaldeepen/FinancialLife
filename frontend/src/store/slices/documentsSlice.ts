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
  // E4: what currency the document itself claims, and whether that contradicts the
  // profile it's being filed into. Undefined/null means "no marker found", which is
  // the common case and is NOT a mismatch.
  currency?: string | null
  currency_mismatch?: boolean
  profile_currency?: string | null
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

// X1: a row in the document library — every document ever uploaded, not just the
// review queue. Extends the pending shape with the two things a library needs and the
// queue never did: what the file was called, and what it turned into.
export interface LibraryDocument extends PendingDocument {
  // NULL for anything uploaded before migration 0006 — render "Untitled document".
  original_filename: string | null
  // A receipt yields one transaction, a statement import yields many; the id is the
  // first one (for a deep link when there's exactly one) and the count tells the UI
  // whether a single link is even the right affordance.
  linked_transaction_id: number | null
  linked_transaction_count: number
}

export interface BulkReviewResult {
  created: number
  duplicates: number
  needs_review: number[]
}

export type DocumentStatusFilter = 'pending' | 'processed' | 'all'

export interface DocumentLibraryFilters {
  status: DocumentStatusFilter
  kind: string
  q: string
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
    // X1 library — deliberately separate state from `pending`. The two views answer
    // different questions and are filtered differently; sharing one array would mean
    // the library's "all" fetch silently widening the Activity review queue.
    library: LibraryDocument[]
    libraryLoading: boolean
    libraryFilters: DocumentLibraryFilters
    fetchLibrary: () => Promise<void>
    setLibraryFilter: <K extends keyof DocumentLibraryFilters>(
      key: K,
      value: DocumentLibraryFilters[K],
    ) => void
    fetchPendingDocuments: (opts?: { force?: boolean }) => Promise<void>
    reviewDocument: (id: number, payload: DocumentReviewPayload) => Promise<DocumentReviewResult>
    rejectDocument: (id: number) => Promise<void>
    // W6: the auto-detect misclassification escape hatch — re-extracts the
    // already-uploaded file under the forced kind and replaces its queue entry in
    // place, so the review dialog re-renders with the corrected extraction.
    reclassifyDocument: (id: number, kind: 'receipt' | 'statement') => Promise<PendingDocument>
    // X4: approve several high-confidence receipts at once. Still runs every one
    // through the D3 dedup gate server-side — bulk never means unchecked.
    bulkReviewDocuments: (ids: number[], accountId: number) => Promise<BulkReviewResult>
    bulkRejectDocuments: (ids: number[]) => Promise<void>
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
  library: [] as LibraryDocument[],
  libraryLoading: true,
  libraryFilters: { status: 'all', kind: '', q: '' } as DocumentLibraryFilters,

  fetchPendingDocuments: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      // No params — the endpoint still defaults to pending-only, so this call is
      // byte-for-byte the pre-X1 request and the review queue is unaffected.
      const res = await api.get('/api/documents/')
      set({ pending: res.data, lastFetchedAt: Date.now() })
    } finally {
      set({ loading: false })
    }
  },

  // Deliberately not staleness-gated (unlike fetchPendingDocuments): this runs in
  // response to a filter change, where returning cached rows for the *previous* filter
  // would be a bug rather than an optimisation.
  fetchLibrary: async () => {
    const { status, kind, q } = get().libraryFilters
    set({ libraryLoading: true })
    try {
      const res = await api.get('/api/documents/', {
        // Empty strings mean "no filter" — omit them so the backend doesn't try to
        // match a literal '' against kind, or ILIKE '%%' on a NULL filename.
        params: { status, ...(kind ? { kind } : {}), ...(q.trim() ? { q: q.trim() } : {}) },
      })
      set({ library: res.data })
    } catch (error) {
      toast.error(getErrorDetail(error, 'Could not load documents'))
    } finally {
      set({ libraryLoading: false })
    }
  },

  setLibraryFilter: <K extends keyof DocumentLibraryFilters>(
    key: K,
    value: DocumentLibraryFilters[K],
  ) => {
    set({ libraryFilters: { ...get().libraryFilters, [key]: value } })
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

  bulkReviewDocuments: async (ids: number[], accountId: number): Promise<BulkReviewResult> => {
    try {
      const res = await api.post('/api/documents/bulk-review', {
        document_ids: ids,
        account_id: accountId,
      })
      const result = res.data as BulkReviewResult
      // Only the documents the server actually resolved leave the queue; anything it
      // pushed back as needs_review stays, so the count on screen stays honest.
      const resolved = new Set(ids.filter((id) => !result.needs_review.includes(id)))
      const pending: PendingDocument[] = get().pending
      set({ pending: pending.filter((d) => !resolved.has(d.id)) })

      const parts = [`${result.created} approved`]
      if (result.duplicates > 0) parts.push(`${result.duplicates} already imported`)
      if (result.needs_review.length > 0) {
        parts.push(`${result.needs_review.length} still need a look`)
      }
      toast.success(parts.join(' · '))
      return result
    } catch (error) {
      toast.error(getErrorDetail(error, 'Bulk approve failed'))
      throw error
    }
  },

  bulkRejectDocuments: async (ids: number[]) => {
    const pending: PendingDocument[] = get().pending
    set({ pending: pending.filter((d) => !ids.includes(d.id)) })
    try {
      await Promise.all(ids.map((id) => api.delete(`/api/documents/${id}`)))
      toast.success(`Discarded ${ids.length} document${ids.length === 1 ? '' : 's'}`)
    } catch (error) {
      set({ pending })
      toast.error(getErrorDetail(error, 'Failed to discard documents'))
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
  // X2: 'skipped' covers both "you already uploaded this file" (content-hash match) and
  // triage rejections. It is deliberately NOT 'failed' — a red row for a file the app
  // correctly decided not to re-upload reads as a bug.
  status: 'pending' | 'uploading' | 'done' | 'failed' | 'skipped'
  error?: string
  /** 0-100 while uploading. Undefined until the first progress event. */
  progress?: number
  /** Folder-relative path, so two `receipt.pdf`s in different folders are tellable apart. */
  path?: string
  /** Why it was skipped, shown instead of a bare "Skipped". */
  note?: string
}

// X2: files are hashed and triaged BEFORE anything uploads, and the user confirms the
// plan. A 200-file folder that starts uploading the instant it is dropped is not a
// feature, it is an accident waiting to happen.
export type UploadPhase = 'idle' | 'scanning' | 'confirm' | 'uploading' | 'done'

export interface TriageSummary {
  document: number
  spreadsheet: number
  other: number
  skipped: number
  alreadyUploaded: number
  truncated: boolean
}

export interface DocumentUploadDialogState {
  // The dialog is rendered once by DesktopLayout, not by whichever page wants it, so
  // its open flag has to be global: Activity's "Upload Receipt" and Quick Add's
  // "Upload receipt" are two entry points into the same one dialog.
  open: boolean
  // W6 routes a dropped .csv/.xlsx to the structured-import wizard instead of the OCR
  // pipeline, but that wizard's state lives in Activity's useCsvImport instance. The
  // file is parked here for Activity to pick up, since the drop can now happen from
  // any page.
  spreadsheetFile: File | null
  dragActive: boolean
  queue: DocumentUploadQueueItem[]
  phase: UploadPhase
  summary: TriageSummary | null
}

export interface DocumentUploadDialogActions {
  checkHashes: (sha256: string[]) => Promise<Set<string>>
  setDocumentUploadOpen: (open: boolean) => void
  setDocumentUploadSpreadsheetFile: (file: File | null) => void
  setDocumentUploadDragActive: (dragActive: boolean) => void
  setDocumentUploadQueue: (queue: DocumentUploadQueueItem[]) => void
  updateDocumentUploadQueueItem: (index: number, patch: Partial<DocumentUploadQueueItem>) => void
  clearDocumentUploadQueue: () => void
  setUploadPhase: (phase: UploadPhase) => void
  setTriageSummary: (summary: TriageSummary | null) => void
  excludeQueueItem: (index: number) => void
}

export type DocumentUploadDialogSlice = {
  documentUploadDialog: DocumentUploadDialogState & DocumentUploadDialogActions
}

export const createDocumentUploadDialogSlice = namespaceSlice(
  'documentUploadDialog',
  (set, get) => ({
    open: false,
    spreadsheetFile: null as File | null,
    dragActive: false,
    queue: [] as DocumentUploadQueueItem[],
    phase: 'idle' as UploadPhase,
    summary: null as TriageSummary | null,

    // V3: the last api call left in a component. Returns the subset the server has
    // already stored, so the triage plan can mark those files "Already uploaded"
    // before a single byte is sent. Fails *open* (empty set) rather than blocking the
    // upload — the server's own dedup still catches repeats, so the worst case of a
    // failed pre-check is a wasted upload, not a duplicate transaction.
    checkHashes: async (sha256: string[]): Promise<Set<string>> => {
      if (sha256.length === 0) return new Set<string>()
      try {
        const res = await api.post('/api/documents/check-hashes', { sha256 })
        return new Set<string>((res.data?.already_uploaded ?? []) as string[])
      } catch {
        return new Set<string>()
      }
    },

    setDocumentUploadOpen: (open: boolean) => set({ open }),
    setDocumentUploadSpreadsheetFile: (file: File | null) => set({ spreadsheetFile: file }),
    setDocumentUploadDragActive: (dragActive: boolean) => set({ dragActive }),
    setDocumentUploadQueue: (queue: DocumentUploadQueueItem[]) => set({ queue }),
    updateDocumentUploadQueueItem: (index: number, patch: Partial<DocumentUploadQueueItem>) => {
      const queue = [...get().queue]
      const current = queue[index]
      if (!current) return
      queue[index] = { ...current, ...patch }
      set({ queue })
    },
    clearDocumentUploadQueue: () => set({ queue: [], phase: 'idle', summary: null }),
    setUploadPhase: (phase: UploadPhase) => set({ phase }),
    setTriageSummary: (summary: TriageSummary | null) => set({ summary }),
    // Excludes a file from the batch WITHOUT removing its row.
    //
    // This used to `filter()` the entry out, which silently corrupted the batch: the
    // queue is index-parallel with the dialog's `pendingFiles` ref holding the actual
    // File objects, and that ref was never spliced to match. After removing one row,
    // every later row's index pointed at the *previous* file — so "retry" re-uploaded
    // the wrong document and progress was written onto the wrong line. Marking the row
    // instead keeps the two arrays aligned by construction, and has the side benefit of
    // showing you what you excluded rather than making it vanish.
    excludeQueueItem: (index: number) => {
      const queue: DocumentUploadQueueItem[] = get().queue
      set({
        queue: queue.map((item, i) =>
          i === index ? { ...item, status: 'skipped' as const, note: 'Removed' } : item,
        ),
      })
    },
  }),
)

// X1: which library row's document is open in the viewer. One piece of state, but it
// lives here rather than in `useState` because the tab already reads five other things
// from the store and rules/zustand.md puts the threshold at 2+.
export type DocumentLibrarySlice = {
  documentLibrary: {
    viewingId: number | null
    setDocumentLibraryViewingId: (viewingId: number | null) => void
  }
}

export const createDocumentLibrarySlice = namespaceSlice('documentLibrary', (set) => ({
  viewingId: null as number | null,
  setDocumentLibraryViewingId: (viewingId: number | null) => set({ viewingId }),
}))

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
