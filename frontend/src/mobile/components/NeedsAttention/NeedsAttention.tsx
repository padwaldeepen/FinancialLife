import { useEffect, type JSX } from 'react'
import { Flex, Text, IconButton } from '@radix-ui/themes'
import { AlertTriangle, Clock, FileText, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './NeedsAttention.module.css'

const ICONS = {
  bills_due_soon: Clock,
  projected_shortfall: AlertTriangle,
  anomaly: AlertTriangle,
  pending_documents: FileText,
} as const

const iconFor = (type: string) => ICONS[type as keyof typeof ICONS] ?? Clock

/**
 * Y3, mobile tree. Same data and the same dismiss-by-type behaviour as the desktop
 * block, but its own layout — the trees never share JSX (rules/frontend.md), and at
 * 390px this has to be a single tight line per item with a touch-sized dismiss target,
 * not the desktop two-line card.
 *
 * The evidence line is dropped here on purpose: the message already carries the point,
 * and a second line of numbers per item would push the actual dashboard below the fold
 * on a phone. Tapping through to the destination shows the detail.
 */
export const NeedsAttention = (): JSX.Element | null => {
  const navigate = useNavigate()
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
    <Flex direction="column" gap="2" className={styles.block} aria-label="Needs attention" asChild>
      <section>
        {attention.map((item) => {
          const Icon = iconFor(item.type)
          return (
            <div
              key={item.type}
              className={styles.item}
              data-severity={item.severity}
              role="button"
              tabIndex={0}
              onClick={() => item.action_path && navigate(item.action_path)}
              onKeyDown={(e) => {
                if (item.action_path && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  navigate(item.action_path)
                }
              }}
            >
              <Icon size={15} className={styles.icon} aria-hidden />
              <Text size="2" className={styles.message}>
                {item.message}
              </Text>
              <IconButton
                size="2"
                variant="ghost"
                color="gray"
                aria-label={`Dismiss: ${item.message}`}
                onClick={(e) => {
                  e.stopPropagation()
                  dismissAttention(item.type)
                }}
              >
                <X size={16} />
              </IconButton>
            </div>
          )
        })}
      </section>
    </Flex>
  )
}
