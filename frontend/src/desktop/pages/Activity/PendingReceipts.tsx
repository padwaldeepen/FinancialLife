import { useEffect, useMemo, useState, type JSX } from 'react'
import { Box, Flex, Text, Card, Badge, Button, Checkbox, Select } from '@radix-ui/themes'
import { FileText, FileSpreadsheet } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import type { PendingDocument } from '../../../store/slices/documentsSlice.ts'
import { DocumentReviewDialog } from './DocumentReviewDialog.tsx'
import { StatementReviewDialog } from './StatementReviewDialog.tsx'
import styles from './Activity.module.css'

// X4: how many rows render before "Show more". X2 can now produce 40+ pending documents
// in a single folder drop, and an unbounded list of cards above the transaction list
// buries the page. Paging in chunks keeps the common case (a handful) identical.
const PAGE_SIZE = 8

// Lower sorts first: the documents that actually need a human decision surface at the
// top, instead of being buried under things the extractor was confident about.
const CONFIDENCE_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 }

const sortKey = (doc: PendingDocument): number => {
  // A statement always needs its own review screen, so it ranks alongside low
  // confidence rather than being auto-approvable.
  if (doc.kind === 'statement') return 0
  return CONFIDENCE_ORDER[doc.extracted_json?.confidence ?? 'low'] ?? 0
}

/** Only these can be bulk-approved; everything else needs the dialog. */
const isAutoApprovable = (doc: PendingDocument): boolean => {
  const ex = doc.extracted_json
  if (!ex || doc.kind === 'statement') return false
  return ex.confidence !== 'low' && ex.total != null && !!ex.date
}

// S3/S4: the review queue — every uploaded document still awaiting a decision. Purely
// additive above the transaction list, quiet when empty (same pattern as I2's
// DetectedSubscriptions).
export const PendingReceipts = (): JSX.Element | null => {
  const currency = useActiveCurrency()
  const { pending, fetchPendingDocuments, bulkReviewDocuments, bulkRejectDocuments } =
    useBoundStore(
      useShallow((s) => ({
        pending: s.documents.pending,
        fetchPendingDocuments: s.documents.fetchPendingDocuments,
        bulkReviewDocuments: s.documents.bulkReviewDocuments,
        bulkRejectDocuments: s.documents.bulkRejectDocuments,
      })),
    )
  const accounts = useBoundStore((s) => s.accounts.items)
  const fetchAccounts = useBoundStore((s) => s.accounts.fetchAccounts)

  const [reviewing, setReviewing] = useState<PendingDocument | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [accountId, setAccountId] = useState<string>('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    fetchPendingDocuments()
    fetchAccounts()
  }, [fetchPendingDocuments, fetchAccounts])

  // Bulk approve has to post to *some* account; default to the first. Derived rather
  // than synced into state by an effect — an effect here would trigger a cascading
  // render (and trips `react-hooks/set-state-in-effect`) for a value that is just
  // "whatever the user picked, else the first account".
  const effectiveAccountId = accountId || (accounts[0] ? String(accounts[0].id) : '')

  const sorted = useMemo(() => [...pending].sort((a, b) => sortKey(a) - sortKey(b)), [pending])
  const shown = sorted.slice(0, visible)
  const approvable = useMemo(() => sorted.filter(isAutoApprovable), [sorted])

  if (pending.length === 0) return null

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllApprovable = () => setSelected(new Set(approvable.map((d) => d.id)))

  const runBulkApprove = async () => {
    if (selected.size === 0 || !effectiveAccountId) return
    setWorking(true)
    try {
      await bulkReviewDocuments(Array.from(selected), Number(effectiveAccountId))
      setSelected(new Set())
    } catch {
      // toast handled in store
    } finally {
      setWorking(false)
    }
  }

  const runBulkDiscard = async () => {
    if (selected.size === 0) return
    setWorking(true)
    try {
      await bulkRejectDocuments(Array.from(selected))
      setSelected(new Set())
    } catch {
      // toast handled in store
    } finally {
      setWorking(false)
    }
  }

  return (
    <Box mb="4">
      <Flex align="center" justify="between" gap="3" mb="2" wrap="wrap">
        <Text as="div" size="2" weight="medium" color="gray">
          Pending Documents ({pending.length})
        </Text>
        {/* Bulk controls only appear once there are enough documents for one-at-a-time
            review to be tedious — below that they'd be clutter. */}
        {pending.length > 1 && (
          <Flex align="center" gap="2" wrap="wrap">
            {selected.size === 0 ? (
              approvable.length > 0 && (
                <Button size="1" variant="soft" onClick={selectAllApprovable}>
                  Select {approvable.length} confident
                </Button>
              )
            ) : (
              <>
                <Text size="1" color="gray">
                  {selected.size} selected
                </Text>
                <Select.Root value={effectiveAccountId} onValueChange={setAccountId}>
                  <Select.Trigger aria-label="Account to post approved receipts to" />
                  <Select.Content>
                    {accounts.map((a) => (
                      <Select.Item key={a.id} value={String(a.id)}>
                        {a.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                <Button
                  size="1"
                  onClick={runBulkApprove}
                  loading={working}
                  disabled={!effectiveAccountId}
                >
                  Approve
                </Button>
                <Button
                  size="1"
                  variant="soft"
                  color="gray"
                  onClick={runBulkDiscard}
                  loading={working}
                >
                  Discard
                </Button>
                <Button size="1" variant="ghost" onClick={() => setSelected(new Set())}>
                  Cancel
                </Button>
              </>
            )}
          </Flex>
        )}
      </Flex>

      <Flex direction="column" gap="2">
        {shown.map((doc) => {
          const ex = doc.extracted_json
          const isStatement = doc.kind === 'statement'
          const txCount = ex?.transactions?.length ?? 0
          const selectable = isAutoApprovable(doc)
          return (
            <Card key={doc.id} className={styles.billItem}>
              <Flex align="center" justify="between" gap="3">
                <Flex align="center" gap="3" className={styles.flex1}>
                  {pending.length > 1 && (
                    <Checkbox
                      checked={selected.has(doc.id)}
                      onCheckedChange={() => toggle(doc.id)}
                      // A statement or a low-confidence scan can't be approved without a
                      // human, so it can't be part of a bulk approve either.
                      disabled={!selectable}
                      aria-label={`Select ${ex?.merchant || 'document'}`}
                    />
                  )}
                  {isStatement ? (
                    <FileSpreadsheet size={18} color="var(--gray-9)" />
                  ) : (
                    <FileText size={18} color="var(--gray-9)" />
                  )}
                  <Box>
                    {isStatement ? (
                      <>
                        <Text as="div" size="2" weight="medium">
                          Bank / card statement
                        </Text>
                        <Text as="div" size="1" color="gray">
                          {txCount > 0
                            ? `${txCount} transaction${txCount === 1 ? '' : 's'} found`
                            : 'No transactions detected'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text as="div" size="2" weight="medium">
                          {ex?.merchant || 'Unknown merchant'}
                        </Text>
                        <Text as="div" size="1" color="gray">
                          {ex?.total != null
                            ? formatCurrency(ex.total, currency)
                            : 'No amount detected'}
                          {ex?.confidence && (
                            <>
                              {' · '}
                              {/* Confidence isn't a money amount, so it can't use
                                  green/red (design-system.md §1) — low confidence gets
                                  the accent color instead, the same "needs a look"
                                  signal used for over-budget progress elsewhere,
                                  everything else stays neutral gray. */}
                              <Badge size="1" color={ex.confidence === 'low' ? undefined : 'gray'}>
                                {ex.confidence} confidence
                              </Badge>
                            </>
                          )}
                        </Text>
                      </>
                    )}
                  </Box>
                </Flex>
                <Button size="1" variant="soft" onClick={() => setReviewing(doc)}>
                  Review
                </Button>
              </Flex>
            </Card>
          )
        })}
      </Flex>

      {sorted.length > visible && (
        <Button size="1" variant="ghost" mt="2" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
          Show {Math.min(PAGE_SIZE, sorted.length - visible)} more of {sorted.length - visible}
        </Button>
      )}

      {reviewing &&
        (reviewing.kind === 'statement' ? (
          <StatementReviewDialog
            document={reviewing}
            onClose={() => setReviewing(null)}
            onReclassified={setReviewing}
          />
        ) : (
          <DocumentReviewDialog
            document={reviewing}
            onClose={() => setReviewing(null)}
            onReclassified={setReviewing}
          />
        ))}
    </Box>
  )
}
