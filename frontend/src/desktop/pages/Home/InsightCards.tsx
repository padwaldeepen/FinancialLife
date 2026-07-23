import { useEffect, type JSX } from 'react'
import { Box, Flex, Text, Card, Badge, IconButton } from '@radix-ui/themes'
import { Sparkles, X, Bot } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import type { AdviceCard } from '../../../store/slices/adviceSlice.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import styles from './Home.module.css'

// I6: rule-generated advice, evidence-backed (design-system.md §4 "transparent AI" —
// every card shows the numbers its claim is based on, never a bare assertion).
// message may be AI-reworded (gated server-side by the user's T5 toggle) but the
// evidence numbers always come from the deterministic rule engine — ai_generated
// only changes whether the Sparkles/Bot badge shows, never what's trustworthy here.
function evidenceLine(card: AdviceCard, currency: string): string {
  const e = card.evidence as Record<string, number | string>
  switch (card.type) {
    case 'anomaly':
      return `${formatCurrency(e.current_month_total as number, currency)} this month vs a ${formatCurrency(e.trailing_avg as number, currency)} average`
    case 'rising_streak': {
      const months = card.evidence.months as { month: string; total: number }[]
      return months.map((m) => formatCurrency(m.total, currency)).join(' → ')
    }
    case 'price_hike':
      return `Now averaging ${formatCurrency(e.avg_amount as number, currency)} per charge`
    case 'budget_drift':
      return `${formatCurrency(e.spent as number, currency)} spent of a ${formatCurrency(e.budget as number, currency)} budget`
    case 'goal_pacing':
      return `${formatCurrency(e.current_amount as number, currency)} of ${formatCurrency(e.target_amount as number, currency)} saved`
    case 'top_subscriptions':
      return `${formatCurrency(e.total_monthly as number, currency)}/month total`
    default:
      return ''
  }
}

export const InsightCards = (): JSX.Element => {
  const currency = useActiveCurrency()
  const { cards, loading, fetchAdvice, dismissAdviceType } = useBoundStore(
    useShallow((s) => ({
      cards: s.advice.cards,
      loading: s.advice.loading,
      fetchAdvice: s.fetchAdvice,
      dismissAdviceType: s.dismissAdviceType,
    })),
  )

  useEffect(() => {
    fetchAdvice()
  }, [fetchAdvice])

  if (loading) return <></>

  if (cards.length === 0) {
    return (
      <Card className={styles.contentCard}>
        <Flex direction="column" align="center" gap="2" className={styles.emptyState}>
          <Sparkles size={20} color="var(--gray-9)" />
          <Text size="2" color="gray" align="center">
            Insights need a bit more data — check back after a few transactions.
          </Text>
        </Flex>
      </Card>
    )
  }

  return (
    <Flex direction="column" gap="2">
      {cards.map((card) => (
        <Card key={card.type} className={styles.contentCard}>
          <Flex align="start" justify="between" gap="3">
            <Box className={styles.flex1}>
              <Flex align="center" gap="2" mb="1">
                <Text weight="medium" size="2">
                  {card.message}
                </Text>
                {card.ai_generated && (
                  <Badge
                    color="purple"
                    variant="soft"
                    title="Reworded by AI — numbers come from the rule engine"
                  >
                    <Bot size={11} /> AI
                  </Badge>
                )}
              </Flex>
              <Text size="1" color="gray">
                {evidenceLine(card, currency)}
              </Text>
            </Box>
            <IconButton
              size="1"
              variant="ghost"
              color="gray"
              aria-label="Dismiss"
              onClick={() => dismissAdviceType(card.type)}
            >
              <X size={14} />
            </IconButton>
          </Flex>
        </Card>
      ))}
    </Flex>
  )
}
