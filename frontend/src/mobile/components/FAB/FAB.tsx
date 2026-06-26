import { type JSX } from 'react'
import { IconButton } from '@radix-ui/themes'
import { Plus } from 'lucide-react'
import styles from './FAB.module.css'

interface FABProps {
  onClick: () => void
}

export const FAB = ({ onClick }: FABProps): JSX.Element => {
  return (
    <IconButton
      className={styles.fab}
      onClick={onClick}
      aria-label="Add transaction"
      size="4"
      highContrast
    >
      <Plus size={24} />
    </IconButton>
  )
}
