import { useEffect, useState, type JSX } from 'react'
import { Box, Flex, Text, TextField, Select, Dialog, Button, Card, Badge } from '@radix-ui/themes'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import api from '../../../shared/api/client.ts'
import toast from '../../../shared/utils/toast.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import type { PendingDocument, FuzzyMatch } from '../../../store/slices/documentsSlice.ts'
import styles from './Activity.module.css'

interface Props {
  document: PendingDocument
  onClose: () => void
}

const todayIso = () => new Date().toISOString().slice(0, 10)

// S3: the one place a scanned document turns into an actual transaction — every
// field starts pre-filled from S2's extraction but is fully editable, and nothing is
// saved until the user explicitly confirms (design-system.md "nothing auto-commits").
export const DocumentReviewDialog = ({ document: doc, onClose }: Props): JSX.Element => {
  const currency = useActiveCurrency()
  const ex = doc.extracted_json
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

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [amount, setAmount] = useState(ex?.total != null ? String(ex.total) : '')
  const [description, setDescription] = useState(ex?.merchant || '')
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense')
  const [accountId, setAccountId] = useState<string>(accounts[0] ? String(accounts[0].id) : '')
  const [categoryId, setCategoryId] = useState<string>(
    ex?.category_id ? String(ex.category_id) : '',
  )
  const [date, setDate] = useState(ex?.date || todayIso())
  const [saving, setSaving] = useState(false)
  const [fuzzyMatches, setFuzzyMatches] = useState<FuzzyMatch[] | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    api
      .get(`/api/documents/${doc.id}`, { responseType: 'blob' })
      .then((res) => {
        setIsPdf(res.data.type === 'application/pdf')
        objectUrl = URL.createObjectURL(res.data)
        setImageUrl(objectUrl)
      })
      .catch(() => toast.error('Could not load the document image'))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [doc.id])

  const buildPayload = (skipDedup: boolean) => ({
    amount: parseFloat(amount),
    description: description.trim(),
    transaction_type: transactionType,
    account_id: Number(accountId),
    category_id: categoryId ? Number(categoryId) : null,
    merchant_id: ex?.merchant_id ?? null,
    date: `${date}T00:00:00`,
    skip_dedup: skipDedup,
  })

  const handleSave = async (skipDedup = false) => {
    if (!amount || !description.trim() || !accountId) {
      toast.error('Amount, description, and account are required')
      return
    }
    setSaving(true)
    try {
      const result = await reviewDocument(doc.id, buildPayload(skipDedup))
      if (result.status === 'created') {
        toast.success('Transaction created')
        fetchTransactions({ reset: true, force: true })
        fetchAccounts({ force: true })
        onClose()
      } else if (result.status === 'exact_duplicate') {
        toast.success('Already imported — nothing new to add')
        onClose()
      } else {
        setFuzzyMatches(result.fuzzy_matches)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save transaction')
    } finally {
      setSaving(false)
    }
  }

  // "Merge" and "skip" both discard the incoming record — same collapse as the CSV
  // import review queue (useCsvImport.resolveReviewRow): no per-field merge target
  // exists in this schema, so either choice means "the existing transaction stands."
  const handleDiscard = async () => {
    await rejectDocument(doc.id)
    toast.success('Receipt discarded')
    onClose()
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="720px">
        <Dialog.Title>Review Receipt</Dialog.Title>

        <Flex gap="4" mt="3">
          <Box className={styles.flex1}>
            {!imageUrl ? (
              <Box className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-3)' }} />
            ) : isPdf ? (
              // Browsers can't render a PDF in an <img> — embed it instead.
              <object
                data={imageUrl}
                type="application/pdf"
                style={{
                  width: '100%',
                  height: 420,
                  borderRadius: 'var(--radius-3)',
                  border: '1px solid var(--gray-4)',
                }}
              >
                <a href={imageUrl} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              </object>
            ) : (
              <img
                src={imageUrl}
                alt="Uploaded receipt"
                style={{
                  width: '100%',
                  borderRadius: 'var(--radius-3)',
                  border: '1px solid var(--gray-4)',
                }}
              />
            )}
            {ex && (
              <Text as="div" size="1" color="gray" mt="2">
                Extracted via {ex.tier} · {ex.confidence} confidence
              </Text>
            )}
          </Box>

          <Flex direction="column" gap="3" className={styles.flex1}>
            <Flex direction="column" gap="1">
              <Text as="div" className={styles.detailLabel}>
                Description
              </Text>
              <TextField.Root
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Flex>

            <Flex direction="column" gap="1">
              <Text as="div" className={styles.detailLabel}>
                Amount
              </Text>
              <TextField.Root
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Flex>

            <Flex direction="column" gap="1">
              <Text as="div" className={styles.detailLabel}>
                Type
              </Text>
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
            </Flex>

            <Flex direction="column" gap="1">
              <Text as="div" className={styles.detailLabel}>
                Account
              </Text>
              <Select.Root value={accountId} onValueChange={setAccountId}>
                <Select.Trigger placeholder="Choose an account" />
                <Select.Content>
                  {accounts.map((a) => (
                    <Select.Item key={a.id} value={String(a.id)}>
                      {a.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>

            <Flex direction="column" gap="1">
              <Text as="div" className={styles.detailLabel}>
                Category
              </Text>
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
            </Flex>

            <Flex direction="column" gap="1">
              <Text as="div" className={styles.detailLabel}>
                Date
              </Text>
              <TextField.Root type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Flex>
          </Flex>
        </Flex>

        {fuzzyMatches && fuzzyMatches.length > 0 && (
          <Card mt="4" className={styles.billItem}>
            <Text as="div" size="2" weight="medium" mb="2">
              This looks similar to an existing transaction
            </Text>
            {fuzzyMatches.map((m) => (
              <Flex key={m.transaction_id} align="center" justify="between" mb="2">
                <Text size="2" color="gray">
                  {m.description} — {formatCurrency(m.amount, currency)} on{' '}
                  {new Date(m.date).toLocaleDateString()}
                  {'  '}
                  <Badge size="1">{Math.round(m.similarity * 100)}% match</Badge>
                </Text>
              </Flex>
            ))}
            <Flex gap="2" justify="end">
              <Button size="1" variant="soft" color="gray" onClick={handleDiscard}>
                Skip (already have it)
              </Button>
              <Button size="1" variant="solid" onClick={() => handleSave(true)} disabled={saving}>
                Keep both
              </Button>
            </Flex>
          </Card>
        )}

        <Flex justify="end" gap="2" mt="4">
          <Button variant="soft" color="gray" onClick={handleDiscard}>
            Discard
          </Button>
          <Button onClick={() => handleSave(false)} disabled={saving}>
            Save Transaction
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
