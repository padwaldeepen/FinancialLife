import { type JSX } from 'react'
import { Card, Flex, Text } from '@radix-ui/themes'
import { formatCurrency } from '../../../shared/utils/format.ts'
import type { Comparison } from '../../../store/slices/reportsSlice.ts'
import styles from './Insights.module.css'

interface Props {
  title: string
  comparison: Comparison
  currency: string
}

const ROWS = [
  {
    field: 'Income' as const,
    current: 'current_income',
    prev: 'previous_income',
    pct: 'income_change_pct',
  },
  {
    field: 'Expenses' as const,
    current: 'current_expense',
    prev: 'previous_expense',
    pct: 'expense_change_pct',
  },
  { field: 'Net' as const, current: 'current_net', prev: 'previous_net', pct: 'net_change_pct' },
] as const

// Shared by the MoM and YoY cards (U6) — same layout, different `comparison` payload
// (the backend's /api/reports/comparison?mode=mom|yoy already computes both shapes
// identically, so one render path covers both).
export const ComparisonCard = ({ title, comparison, currency }: Props): JSX.Element => (
  <Card size="2" className={styles.comparisonCard}>
    <Text as="div" className={styles.comparisonTitle}>
      {title}
    </Text>
    <Text as="div" size="1" color="gray" mb="3">
      {comparison.label}
    </Text>
    {ROWS.map((row) => {
      const current = comparison[row.current]
      const prev = comparison[row.prev]
      const pct = comparison[row.pct]
      // "Up" is good news for Income/Net but bad news for Expenses — flip which
      // direction reads as green/red per field instead of coloring purely by sign.
      const goodDirection = row.field === 'Expenses' ? -1 : 1
      const color = pct === null || pct === 0 ? 'gray' : pct * goodDirection > 0 ? 'green' : 'red'
      return (
        <Flex key={row.field} className={styles.comparisonRow} justify="between" align="center">
          <Text size="2" color="gray" className={styles.comparisonFieldName}>
            {row.field}
          </Text>
          <Flex align="center" gap="4">
            <Text size="3" weight="medium" className={styles.comparisonCurrent}>
              {formatCurrency(current, currency)}
            </Text>
            <Text size="2" color="gray" className={styles.comparisonPrev}>
              {formatCurrency(prev, currency)}
            </Text>
            <Text size="2" weight="medium" className={styles.comparisonChange} color={color}>
              {pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`}
            </Text>
          </Flex>
        </Flex>
      )
    })}
  </Card>
)
