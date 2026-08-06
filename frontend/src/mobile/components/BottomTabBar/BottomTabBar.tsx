import { type JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { Flex, Text, IconButton } from '@radix-ui/themes'
import { LayoutDashboard, ArrowLeftRight, Plus } from 'lucide-react'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './BottomTabBar.module.css'

// U8: mobile = Home/Activity/Capture, nothing else — Bills and More (and everything
// More led to) are retired, so the tab bar drops to these two plus the center
// Capture button.
export const BottomTabBar = (): JSX.Element => {
  const openCaptureSheet = useBoundStore((s) => s.ui.openCaptureSheet)

  return (
    <nav className={styles.bar}>
      <NavLink
        to="/"
        end
        className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
      >
        <Flex direction="column" align="center" gap="1">
          <LayoutDashboard size={22} />
          <Text size="1" className={styles.label}>
            Home
          </Text>
        </Flex>
      </NavLink>

      <IconButton
        className={styles.addButton}
        onClick={openCaptureSheet}
        aria-label="Capture transaction"
        highContrast
        size="4"
      >
        <Plus size={28} />
      </IconButton>

      <NavLink
        to="/activity"
        className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
      >
        <Flex direction="column" align="center" gap="1">
          <ArrowLeftRight size={22} />
          <Text size="1" className={styles.label}>
            Activity
          </Text>
        </Flex>
      </NavLink>
    </nav>
  )
}
