import { type JSX } from 'react'
import * as Toast from '@radix-ui/react-toast'
import { Flex, IconButton } from '@radix-ui/themes'
import { CheckCircle2, XCircle, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './ToastHost.module.css'

// Radix's own Toast primitive (@radix-ui/react-toast) — already resolved in
// node_modules as a dependency of @radix-ui/themes, not a new package. Unstyled by
// design, so the visuals below use the same Radix color tokens as everything else;
// what it buys over a hand-rolled stack is the accessibility work already done
// (ARIA live region, swipe-to-dismiss, pause-on-hover/focus) instead of reimplementing
// it. Cross-device shared (rules/frontend.md's "no shared/components/" exception):
// identical notification behavior everywhere, not a device-specific layout.
export const ToastHost = (): JSX.Element => {
  const { items, dismissToast } = useBoundStore(
    useShallow((s) => ({ items: s.toasts.items, dismissToast: s.toasts.dismissToast })),
  )

  return (
    <Toast.Provider swipeDirection="down" duration={4000}>
      {items.map((t) => (
        <Toast.Root
          key={t.id}
          className={`${styles.toast} ${t.variant === 'success' ? styles.success : styles.error}`}
          onOpenChange={(open) => {
            if (!open) dismissToast(t.id)
          }}
        >
          <Flex align="center" gap="2" className={styles.content}>
            {t.variant === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <Toast.Description className={styles.message}>{t.message}</Toast.Description>
          </Flex>
          <Toast.Close asChild>
            <IconButton variant="ghost" color="gray" size="1" aria-label="Dismiss">
              <X size={14} />
            </IconButton>
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className={styles.viewport} />
    </Toast.Provider>
  )
}
