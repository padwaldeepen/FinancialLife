import { type JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { Box, Text, Button } from '@radix-ui/themes'
import { LayoutDashboard, ArrowLeftRight, Repeat, BarChart3, Settings, Plus } from 'lucide-react'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Sidebar.module.css'

const navItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/activity', label: 'Activity', icon: ArrowLeftRight },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/manage', label: 'Manage', icon: Settings },
]

export const Sidebar = (): JSX.Element => {
  const openAddModal = useBoundStore((s) => s.openAddModal)

  return (
    <aside className={styles.sidebar}>
      <Box className={styles.logo}>
        <Text as="div" className={styles.logoIcon}>
          F
        </Text>
        <Text as="span" className={styles.logoText}>
          My Financial Life
        </Text>
      </Box>

      <Button className={styles.addButton} onClick={openAddModal}>
        <Plus size={18} />
        Add Transaction
      </Button>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <item.icon size={18} />
            <Text as="span">{item.label}</Text>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
