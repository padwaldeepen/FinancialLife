import { namespaceSlice, isFresh } from '../namespaceSlice.ts'
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
  }
  fetchPendingDocuments: (opts?: { force?: boolean }) => Promise<void>
  reviewDocument: (id: number, payload: DocumentReviewPayload) => Promise<DocumentReviewResult>
  rejectDocument: (id: number) => Promise<void>
  fetchStatementRows: (id: number, accountId: number) => Promise<StatementReview>
  importStatement: (
    id: number,
    accountId: number,
    rows: StatementImportRow[],
  ) => Promise<StatementImportResult>
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
    const res = await api.post(`/api/documents/${id}/review`, payload)
    const result = res.data as DocumentReviewResult
    if (result.status !== 'fuzzy_duplicate') {
      const pending: PendingDocument[] = get().pending
      set({ pending: pending.filter((d) => d.id !== id) })
    }
    return result
  },

  rejectDocument: async (id: number) => {
    const pending: PendingDocument[] = get().pending
    set({ pending: pending.filter((d) => d.id !== id) })
    try {
      await api.delete(`/api/documents/${id}`)
    } catch {
      set({ pending })
      toast.error('Failed to remove document')
    }
  },

  fetchStatementRows: async (id: number, accountId: number): Promise<StatementReview> => {
    const res = await api.get(`/api/documents/${id}/statement`, {
      params: { account_id: accountId },
    })
    return res.data as StatementReview
  },

  importStatement: async (
    id: number,
    accountId: number,
    rows: StatementImportRow[],
  ): Promise<StatementImportResult> => {
    const res = await api.post(`/api/documents/${id}/statement/import`, {
      account_id: accountId,
      rows,
    })
    // The statement is fully consumed on import (server marks it reviewed) — drop it
    // from the pending queue, same as a completed single-receipt review.
    const pending: PendingDocument[] = get().pending
    set({ pending: pending.filter((d) => d.id !== id) })
    return res.data as StatementImportResult
  },
}))
