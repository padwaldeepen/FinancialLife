import { useEffect, type JSX } from 'react'
import { Flex, Text, IconButton } from '@radix-ui/themes'
import { AlertTriangle, Clock, FileText, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import type { AttentionItem } from '../../../store/slices/adviceSlice.ts'
import styles from './NeedsAttention.module.css'

const ICONS = {
  bills_due_soon: Clock,
  projected_shortfall: AlertTriangle,
  anomaly: AlertTriangle,
  pending_documents: FileText,
} as const

const iconFor = (type: string) => ICONS[type as keyof typeof ICONS] ?? Clock

/** One line of supporting numbers, so an alert is never a bare assertion. */
const evidenceLine = (item: AttentionItem, currency: string): string | null => {
  const e = item.evidence
  if (item.type === 'bills_due_soon') {
    const total = typeof e.total === 'number' ? formatCurrency(e.total, currency) : null
    const name = typeof e.soonest_name === 'string' ? e.soonest_name : null
    const days = typeof e.days_away === 'number' ? e.days_away : null
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
    return [total, name ? `${name} ${when}` : null].filter(Boolean).join(' · ')
  }
  if (item.type === 'projected_shortfall' && typeof e.days_away === 'number') {
    const when =
      e.days_away <= 0 ? 'Already there' : e.days_away === 1 ? 'Tomorrow' : `In ${e.days_away} days`
    return `${when}, based on your recurring bills and recent spending`
  }
  if (typeof e.current_month_total === 'number' && typeof e.average === 'number') {
    return `${formatCurrency(e.current_month_total, currency)} this month vs ${formatCurrency(e.average, currency)} typical`
  }
  return null
}

/**
 * Y3 — the block that makes the app tell you things instead of waiting to be asked.
 *
 * Everything here was already being computed (forecast, recurring bills, spend
 * anomalies, the review queue) and then shown only if you went looking for it. There is
 * deliberately no push infrastructure: this is a localhost app, so notifications would
 * be a rabbit hole for no gain.
 *
 * Renders **nothing at all** when there's nothing wrong — a permanent "You're all
 * clear!" card is furniture that trains you to ignore the space, which is exactly the
 * space an urgent alert needs to appear in.
 */
export const NeedsAttention = (): JSX.Element | null => {
  const navigate = useNavigate()
  const currency = useActiveCurrency()
  const { attention, fetchAttention, dismissAttention } = useBoundStore(
    useShallow((s) => ({
      attention: s.advice.attention,
      fetchAttention: s.advice.fetchAttention,
      dismissAttention: s.advice.dismissAttention,
    })),
  )

  useEffect(() => {
    fetchAttention()
  }, [fetchAttention])

  if (attention.length === 0) return null

  return (
    <section className={styles.block} aria-label="Needs attention">
      <Text as="div" className={styles.heading}>
        Needs attention
      </Text>
      <Flex direction="column" gap="2">
        {attention.map((item) => {
          const Icon = iconFor(item.type)
          const evidence = evidenceLine(item, currency)
          const actionable = item.action_path !== null
          return (
            <div
              key={item.type}
              className={styles.item}
              data-severity={item.severity}
              role={actionable ? 'button' : undefined}
              tabIndex={actionable ? 0 : undefined}
              onClick={() => item.action_path && navigate(item.action_path)}
              onKeyDown={(e) => {
                if (item.action_path && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  navigate(item.action_path)
                }
              }}
            >
              <Icon size={16} className={styles.icon} aria-hidden />
              <div className={styles.body}>
                <Text as="div" size="2" weight="medium">
                  {item.message}
                </Text>
                {evidence && (
                  <Text as="div" size="1" color="gray">
                    {evidence}
                  </Text>
                )}
              </div>
              <IconButton
                size="1"
                variant="ghost"
                color="gray"
                aria-label={`Dismiss: ${item.message}`}
                onClick={(e) => {
                  e.stopPropagation()
                  dismissAttention(item.type)
                }}
              >
                <X size={14} />
              </IconButton>
            </div>
          )
        })}
      </Flex>
    </section>
  )
}
