import { useEffect, type JSX } from 'react'
import { Box, Flex, Text, Card, Badge, Button } from '@radix-ui/themes'
import { TrendingUp } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import { frequencyLabel } from '../../../shared/utils/money.ts'
import styles from './Recurring.module.css'

// I2: surfaces I1's detection engine (GET /api/insights/recurring) — rule-found
// subscriptions the user never manually entered as a Bill, distinct from the
// "All Recurring" table above which only ever shows what was explicitly created
// there. A dismissed group is excluded from re-detection (persisted server-side),
// not just hidden client-side — see recurringInsightsSlice.dismissRecurringGroup.
export const DetectedSubscriptions = (): JSX.Element | null => {
  const currency = useActiveCurrency()
  const { items, loading, fetchRecurringInsights, dismissRecurringGroup } = useBoundStore(
    useShallow((s) => ({
      items: s.recurringInsights.items,
      loading: s.recurringInsights.loading,
      fetchRecurringInsights: s.recurringInsights.fetchRecurringInsights,
      dismissRecurringGroup: s.recurringInsights.dismissRecurringGroup,
    })),
  )

  useEffect(() => {
    fetchRecurringInsights()
  }, [fetchRecurringInsights])

  // Purely additive to the manually-tracked bills above — no detections yet is a
  // normal, quiet state, not an error or an empty-state callout.
  if (loading || items.length === 0) return null

  const subscriptions = items.filter((c) => c.transaction_type === 'expense')
  if (subscriptions.length === 0) return null

  const total = subscriptions.reduce((sum, c) => sum + c.monthly_equivalent, 0)

  return (
    <Box mb="6">
      <Flex align="center" justify="between" mb="3">
        <Text as="div" className={styles.sectionTitle}>
          Detected Subscriptions
        </Text>
        <Text size="2" color="gray">
          Total per month{' '}
          <Text weight="bold" color="gray" highContrast>
            {formatCurrency(total, currency)}
          </Text>
        </Text>
      </Flex>
      <Flex direction="column" gap="2">
        {subscriptions.map((c) => (
          <Card key={c.group_key} className={styles.budgetCard}>
            <Flex align="center" justify="between" gap="3">
              <Box className={styles.flex1Min0}>
                <Flex align="center" gap="2">
                  <Text weight="medium">{c.display_name}</Text>
                  {c.price_hike && (
                    <Badge title="The amount changed since earlier charges">
                      <TrendingUp size={12} /> Price increased
                    </Badge>
                  )}
                </Flex>
                <Text size="1" color="gray">
                  {frequencyLabel(c.cadence)} · next{' '}
                  {new Date(c.next_expected_date).toLocaleDateString()}
                </Text>
              </Box>
              <Flex align="center" gap="3">
                <Text weight="bold">{formatCurrency(c.monthly_equivalent, currency)}/mo</Text>
                <Button
                  size="1"
                  variant="ghost"
                  color="gray"
                  onClick={() => dismissRecurringGroup(c.group_key)}
                >
                  Not a subscription
                </Button>
              </Flex>
            </Flex>
          </Card>
        ))}
      </Flex>
    </Box>
  )
}
