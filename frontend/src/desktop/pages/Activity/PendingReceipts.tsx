import { useEffect, useState, type JSX } from 'react'
import { Box, Flex, Text, Card, Badge, Button } from '@radix-ui/themes'
import { FileText, FileSpreadsheet } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import type { PendingDocument } from '../../../store/slices/documentsSlice.ts'
import { DocumentReviewDialog } from './DocumentReviewDialog.tsx'
import { StatementReviewDialog } from './StatementReviewDialog.tsx'
import styles from './Activity.module.css'

// S3/S4: the review queue — every uploaded document (single receipt or bank/card
// statement) still awaiting a decision. Purely additive above the transaction list,
// quiet when empty (same pattern as I2's DetectedSubscriptions).
export const PendingReceipts = (): JSX.Element | null => {
  const currency = useActiveCurrency()
  const { pending, fetchPendingDocuments } = useBoundStore(
    useShallow((s) => ({
      pending: s.documents.pending,
      fetchPendingDocuments: s.documents.fetchPendingDocuments,
    })),
  )
  const [reviewing, setReviewing] = useState<PendingDocument | null>(null)

  useEffect(() => {
    fetchPendingDocuments()
  }, [fetchPendingDocuments])

  if (pending.length === 0) return null

  return (
    <Box mb="4">
      <Text as="div" size="2" weight="medium" color="gray" mb="2">
        Pending Documents ({pending.length})
      </Text>
      <Flex direction="column" gap="2">
        {pending.map((doc) => {
          const ex = doc.extracted_json
          const isStatement = doc.kind === 'statement'
          const txCount = ex?.transactions?.length ?? 0
          return (
            <Card key={doc.id} className={styles.billItem}>
              <Flex align="center" justify="between" gap="3">
                <Flex align="center" gap="3" className={styles.flex1}>
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
                              <Badge
                                size="1"
                                color={
                                  ex.confidence === 'high'
                                    ? 'green'
                                    : ex.confidence === 'medium'
                                      ? 'amber'
                                      : 'gray'
                                }
                              >
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
