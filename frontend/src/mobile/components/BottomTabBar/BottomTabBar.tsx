import { type JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { Flex, Text, IconButton } from '@radix-ui/themes'
import { LayoutDashboard, ArrowLeftRight, Plus, Receipt, MoreHorizontal } from 'lucide-react'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './BottomTabBar.module.css'

const tabs = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/activity', label: 'Activity', icon: ArrowLeftRight },
  { to: '/bills', label: 'Bills', icon: Receipt },
  { to: '/more', label: 'More', icon: MoreHorizontal },
]

export const BottomTabBar = (): JSX.Element => {
  const openAddModal = useBoundStore((s) => s.openAddModal)

  return (
    <nav className={styles.bar}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
        >
          <Flex direction="column" align="center" gap="1">
            <tab.icon size={22} />
            <Text size="1" className={styles.label}>
              {tab.label}
            </Text>
          </Flex>
        </NavLink>
      ))}
      <IconButton
        className={styles.addButton}
        onClick={openAddModal}
        aria-label="Add transaction"
        highContrast
        size="4"
      >
        <Plus size={28} />
      </IconButton>
    </nav>
  )
}
