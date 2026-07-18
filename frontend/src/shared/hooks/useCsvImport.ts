import { useCallback, useState } from 'react'
import Papa from 'papaparse'
import toast from '../utils/toast.ts'
import api from '../../shared/api/client.ts'

export type ImportStep = 'upload' | 'map' | 'preview' | 'review'

export interface ImportRow {
  amount: number
  description: string
  transaction_type: string
  account_id: number
  date: string
  notes: string | null
  skip_dedup?: boolean
}

export interface FuzzyMatchInfo {
  transaction_id: number
  date: string
  amount: number
  description: string
  merchant_name: string | null
  similarity: number
}

export interface PendingReviewRow {
  row_index: number
  transaction: ImportRow
  matches: FuzzyMatchInfo[]
}

const MAPPING_FIELDS = [
  'date',
  'description',
  'amount',
  'type',
  'category',
  'merchant',
  'account',
  'notes',
] as const

const emptyMapping = (): Record<string, string> =>
  Object.fromEntries(MAPPING_FIELDS.map((f) => [f, '']))

// Shared with ImportDialog's preview table so the preview shows exactly what will be
// imported, instead of a second, independently-drifting copy of this logic.
export const classifyImportType = (rawType: string, rawAmount: number): string => {
  const t = rawType.toLowerCase()
  if (t.includes('income') || t.includes('credit')) return 'income'
  if (!t.includes('expense') && !t.includes('debit')) return rawAmount < 0 ? 'expense' : 'income'
  return 'expense'
}

// Shared between desktop/mobile Activity (rules/dry.md) — CSV parsing, column
// auto-detection, and the dedup review queue (U4 wires D3's `services/ingest/dedup.py`
// into `POST /api/transactions/import`, which now skips exact duplicates automatically
// and returns fuzzy matches for the user to resolve here instead of inserting blind).
export const useCsvImport = (defaultAccountId: number | undefined, onImported: () => void) => {
  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState<ImportStep>('upload')
  const [importCsvHeaders, setImportCsvHeaders] = useState<string[]>([])
  const [importCsvRows, setImportCsvRows] = useState<Record<string, string>[]>([])
  const [importMapping, setImportMapping] = useState<Record<string, string>>(emptyMapping())
  const [importing, setImporting] = useState(false)
  const [pendingReview, setPendingReview] = useState<PendingReviewRow[]>([])
  const [exactSkipped, setExactSkipped] = useState(0)

  const resetImport = useCallback(() => {
    setImportStep('upload')
    setImportCsvHeaders([])
    setImportCsvRows([])
    setImportMapping(emptyMapping())
    setPendingReview([])
    setExactSkipped(0)
  }, [])

  const autoDetectMapping = useCallback((headers: string[]) => {
    const lower = headers.map((h) => h.toLowerCase().trim())
    const mapping = emptyMapping()
    const patterns: Record<string, string[]> = {
      date: ['date', 'trans date', 'transaction date', 'posted date'],
      description: ['description', 'desc', 'payee', 'memo', 'name', 'narrative'],
      amount: ['amount', 'debit', 'credit', 'value', 'sum'],
      type: ['type', 'transaction type', 'debit/credit'],
      category: ['category', 'cat', 'group'],
      merchant: ['merchant', 'payee', 'vendor'],
      account: ['account', 'account name', 'acct'],
      notes: ['notes', 'note', 'memo', 'comment'],
    }
    for (const [field, keywords] of Object.entries(patterns)) {
      for (const kw of keywords) {
        const idx = lower.findIndex((h) => h === kw || h.includes(kw))
        if (idx !== -1) {
          mapping[field] = headers[idx] || ''
          break
        }
      }
    }
    return mapping
  }, [])

  const handleImportFile = useCallback(
    (file: File) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            toast.error('CSV parse error: ' + (results.errors[0]?.message || 'Unknown error'))
            return
          }
          const data = results.data as Record<string, string>[]
          if (data.length === 0) {
            toast.error('CSV is empty')
            return
          }
          const headers = results.meta.fields || (data[0] ? Object.keys(data[0]) : [])
          setImportCsvHeaders(headers)
          setImportCsvRows(data)
          setImportMapping(autoDetectMapping(headers))
          setImportStep('map')
        },
      })
    },
    [autoDetectMapping],
  )

  const buildRows = useCallback((): ImportRow[] => {
    const amtCol = importMapping.amount || ''
    const typeCol = importMapping.type || ''
    const dateCol = importMapping.date || ''
    const descCol = importMapping.description || ''
    const notesCol = importMapping.notes || ''
    return importCsvRows.map((row) => {
      const rawAmount = parseFloat((row[amtCol] || '0').replace(/[^0-9.-]/g, ''))
      const txType = classifyImportType(row[typeCol] || '', rawAmount)
      const amount = Math.abs(rawAmount)
      const dateStr = row[dateCol] || ''
      const parsed = new Date(dateStr)
      const date = isNaN(parsed.getTime()) ? new Date() : parsed
      return {
        amount,
        description: row[descCol] || 'Imported transaction',
        transaction_type: txType,
        account_id: defaultAccountId ?? 0,
        date: date.toISOString(),
        notes: notesCol ? row[notesCol] || null : null,
      }
    })
  }, [importCsvRows, importMapping, defaultAccountId])

  const closeImport = () => {
    setImportOpen(false)
    resetImport()
    onImported()
  }

  const handleImportConfirm = async () => {
    if (!importMapping.date || !importMapping.description || !importMapping.amount) {
      toast.error('Date, Description, and Amount columns are required')
      return
    }
    if (!defaultAccountId) {
      toast.error('No accounts found — create one first')
      return
    }
    setImporting(true)
    try {
      const transactions = buildRows()
      const res = await api.post('/api/transactions/import', { transactions })
      const { imported, exact_skipped, pending_review, errors } = res.data as {
        imported: number
        exact_skipped: number
        pending_review: PendingReviewRow[]
        errors: string[]
      }
      if (errors?.length > 0) toast.error(`${errors.length} rows failed`)
      if (pending_review.length > 0) {
        toast.success(
          exact_skipped > 0
            ? `Imported ${imported}, skipped ${exact_skipped} exact duplicates — ${pending_review.length} need your review`
            : `Imported ${imported} — ${pending_review.length} possible duplicates need your review`,
        )
        setPendingReview(pending_review)
        setExactSkipped(exact_skipped)
        setImportStep('review')
        return
      }
      toast.success(
        exact_skipped > 0
          ? `Imported ${imported} transactions, skipped ${exact_skipped} duplicates`
          : `Imported ${imported} transactions`,
      )
      closeImport()
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  // "Merge" and "skip" both discard the incoming row — the existing transaction is
  // treated as canonical either way. There's no per-field merge target in this schema
  // (no way to blend two transaction records), so the two review actions collapse to
  // the same backend outcome; kept as distinct labels since the choice still matters
  // to the user (skip = "wasn't a match", merge = "this is a match, keep the old one").
  const resolveReviewRow = async (rowIndex: number, decision: 'skip' | 'merge' | 'keep-both') => {
    const row = pendingReview.find((r) => r.row_index === rowIndex)
    if (!row) return
    if (decision === 'keep-both') {
      try {
        await api.post('/api/transactions/import', {
          transactions: [{ ...row.transaction, skip_dedup: true }],
        })
        toast.success('Transaction kept')
      } catch {
        toast.error('Failed to save transaction')
      }
    }
    const remaining = pendingReview.filter((r) => r.row_index !== rowIndex)
    setPendingReview(remaining)
    if (remaining.length === 0) {
      toast.success('Review complete')
      closeImport()
    }
  }

  return {
    importOpen,
    setImportOpen,
    importStep,
    setImportStep,
    importCsvHeaders,
    importCsvRows,
    importMapping,
    setImportMapping,
    importing,
    pendingReview,
    exactSkipped,
    resetImport,
    handleImportFile,
    handleImportConfirm,
    resolveReviewRow,
  }
}
