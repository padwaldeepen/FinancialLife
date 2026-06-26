import { type JSX } from 'react'
import { Plus } from 'lucide-react'
import styles from './FAB.module.css'

interface FABProps {
  onClick: () => void
}

export const FAB = ({ onClick }: FABProps): JSX.Element => {
  return (
    <button className={styles.fab} onClick={onClick} aria-label="Add transaction">
      <Plus size={24} />
    </button>
  )
}
