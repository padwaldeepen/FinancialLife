import { useEffect, useState, type JSX } from 'react'
import { Box, Flex, Text, TextField, Select, Dialog, Button, Badge } from '@radix-ui/themes'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import api from '../../../shared/api/client.ts'
import toast from '../../../shared/utils/toast.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import type { FuzzyMatch, PendingDocument } from '../../../store/slices/documentsSlice.ts'
import styles from './DocumentReview.module.css'

const todayIso = () => new Date().toISOString().slice(0, 10)

// S6: mobile review sheet for a just-scanned receipt. Mobile-tree twin of desktop's
// DocumentReviewDialog (trees never share layout, rules/frontend.md) — same store slice
// and endpoints, simplified for one-handed use. Opened via ui.scanReviewDocId (set by the
// scan flow or the pending-receipts entry on Activity). This outer component only resolves
// the document; the keyed inner sheet holds the form so its useState initializers run fresh
// per document (no state-seeding effects).
export const DocumentReview = (): JSX.Element | null => {
  const { docId, pending, closeScanReview, fetchPendingDocuments, fetchAccounts, fetchCategories } =
    useBoundStore(
      useShallow((s) => ({
        docId: s.ui.scanReviewDocId,
        pending: s.documents.pending,
        closeScanReview: s.closeScanReview,
        fetchPendingDocuments: s.fetchPendingDocuments,
        fetchAccounts: s.fetchAccounts,
        fetchCategories: s.fetchCategories,
      })),
    )

  const doc = docId == null ? undefined : pending.find((d) => d.id === docId)

  // Make sure the store has what the sheet needs (the scan flow refreshes pending before
  // opening; this also covers the Activity entry point and account/category lists).
  useEffect(() => {
    if (docId == null) return
    fetchAccounts()
    fetchCategories()
    if (!pending.some((d) => d.id === docId)) fetchPendingDocuments({ force: true })
  }, [docId, pending, fetchAccounts, fetchCategories, fetchPendingDocuments])

  if (docId == null || !doc) return null

  // `key` remounts the sheet per document, so its form initializers re-seed cleanly.
  return <ReviewSheet key={doc.id} doc={doc} onClose={closeScanReview} />
}

const ReviewSheet = ({
  doc,
  onClose,
}: {
  doc: PendingDocument
  onClose: () => void
}): JSX.Element => {
  const currency = useActiveCurrency()
  const { accounts, categories, reviewDocument, rejectDocument, fetchTransactions, fetchAccounts } =
    useBoundStore(
      useShallow((s) => ({
        accounts: s.accounts.items,
        categories: s.categories.flat,
        reviewDocument: s.reviewDocument,
        rejectDocument: s.rejectDocument,
        fetchTransactions: s.fetchTransactions,
        fetchAccounts: s.fetchAccounts,
      })),
    )
  const ex = doc.extracted_json

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [amount, setAmount] = useState(ex?.total != null ? String(ex.total) : '')
  const [description, setDescription] = useState(ex?.merchant || '')
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense')
  const [accountId, setAccountId] = useState(accounts[0] ? String(accounts[0].id) : '')
  const [categoryId, setCategoryId] = useState(ex?.category_id ? String(ex.category_id) : '')
  const [date, setDate] = useState(ex?.date || todayIso())
  const [saving, setSaving] = useState(false)
  const [fuzzyMatches, setFuzzyMatches] = useState<FuzzyMatch[] | null>(null)

  // Fetch the scanned image as an authenticated blob (a plain <img src> can't carry the
  // auth headers GET /documents/{id} needs) — same approach as the desktop dialogs.
  useEffect(() => {
    let objectUrl: string | null = null
    api
      .get(`/api/documents/${doc.id}`, { responseType: 'blob' })
      .then((res) => {
        setIsPdf(res.data.type === 'application/pdf')
        objectUrl = URL.createObjectURL(res.data)
        setImageUrl(objectUrl)
      })
      .catch(() => {
        /* preview is a nicety; the form still works without it */
      })
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [doc.id])

  const handleSave = async (skipDedup = false) => {
    if (!amount || !description.trim() || !accountId) {
      toast.error('Amount, description, and account are required')
      return
    }
    setSaving(true)
    try {
      const result = await reviewDocument(doc.id, {
        amount: parseFloat(amount),
        description: description.trim(),
        transaction_type: transactionType,
        account_id: Number(accountId),
        category_id: categoryId ? Number(categoryId) : null,
        merchant_id: ex?.merchant_id ?? null,
        date: `${date}T00:00:00`,
        skip_dedup: skipDedup,
      })
      if (result.status === 'created') {
        toast.success('Transaction added')
        fetchTransactions({ reset: true, force: true })
        fetchAccounts({ force: true })
        onClose()
      } else if (result.status === 'exact_duplicate') {
        toast.success('Already added — nothing new')
        onClose()
      } else {
        setFuzzyMatches(result.fuzzy_matches)
      }
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data
        ?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = async () => {
    // Close first (clears scanReviewDocId) so the outer component's "doc missing →
    // refetch pending" safety net doesn't fire during the optimistic removal and race
    // the DELETE — that race could read the not-yet-deleted doc back into the list.
    onClose()
    await rejectDocument(doc.id)
    toast.success('Receipt discarded')
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content aria-describedby={undefined} className={styles.sheet}>
        <Dialog.Title className={styles.title}>Review receipt</Dialog.Title>

        {imageUrl &&
          (isPdf ? (
            <object data={imageUrl} type="application/pdf" className={styles.preview}>
              <a href={imageUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </object>
          ) : (
            <img src={imageUrl} alt="Scanned receipt" className={styles.preview} />
          ))}
        {ex && (
          <Text as="div" size="1" color="gray" mt="1" mb="2">
            Read via {ex.tier}
            {ex.confidence ? ` · ${ex.confidence} confidence` : ''}
          </Text>
        )}

        <Flex direction="column" gap="3">
          <Field label="Description">
            <TextField.Root value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Amount">
            <TextField.Root
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Type">
            <Select.Root
              value={transactionType}
              onValueChange={(v) => setTransactionType(v as 'expense' | 'income')}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="expense">Expense</Select.Item>
                <Select.Item value="income">Income</Select.Item>
              </Select.Content>
            </Select.Root>
          </Field>
          <Field label="Account">
            <Select.Root value={accountId} onValueChange={setAccountId}>
              <Select.Trigger placeholder="Choose account" />
              <Select.Content>
                {accounts.map((a) => (
                  <Select.Item key={a.id} value={String(a.id)}>
                    {a.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Field>
          <Field label="Category">
            <Select.Root value={categoryId} onValueChange={setCategoryId}>
              <Select.Trigger placeholder="None" />
              <Select.Content>
                <Select.Item value="">None</Select.Item>
                {categories.map((c) => (
                  <Select.Item key={c.id} value={String(c.id)}>
                    {c.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Field>
          <Field label="Date">
            <TextField.Root type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </Flex>

        {fuzzyMatches && fuzzyMatches.length > 0 && (
          <Box className={styles.dupWarn} mt="3">
            <Text as="div" size="2" weight="medium" mb="1">
              Looks like one you already have
            </Text>
            {fuzzyMatches.map((m) => (
              <Text as="div" key={m.transaction_id} size="1" color="gray">
                {m.description} — {formatCurrency(m.amount, currency)}{' '}
                <Badge size="1">{Math.round(m.similarity * 100)}%</Badge>
              </Text>
            ))}
            <Flex gap="2" mt="2">
              <Button
                size="2"
                variant="soft"
                color="gray"
                onClick={handleDiscard}
                className={styles.grow}
              >
                Skip
              </Button>
              <Button
                size="2"
                onClick={() => handleSave(true)}
                disabled={saving}
                className={styles.grow}
              >
                Keep both
              </Button>
            </Flex>
          </Box>
        )}

        <Flex gap="2" mt="4">
          <Button
            size="3"
            variant="soft"
            color="gray"
            onClick={handleDiscard}
            className={styles.grow}
          >
            Discard
          </Button>
          <Button
            size="3"
            onClick={() => handleSave(false)}
            disabled={saving}
            className={styles.grow}
          >
            Save
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

const Field = ({ label, children }: { label: string; children: JSX.Element }): JSX.Element => (
  <Flex direction="column" gap="1">
    <Text as="div" size="1" color="gray">
      {label}
    </Text>
    {children}
  </Flex>
)
