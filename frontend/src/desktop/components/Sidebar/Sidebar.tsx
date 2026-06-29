import { type JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { Box, Flex, Text, IconButton } from '@radix-ui/themes'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Receipt,
  Store,
  Tags,
  Target,
  BarChart3,
  Settings,
  Plus,
} from 'lucide-react'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Sidebar.module.css'

const navItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/activity', label: 'Activity', icon: ArrowLeftRight },
  { to: '/bills', label: 'Bills', icon: Receipt },
  { to: '/merchants', label: 'Merchants', icon: Store },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const Sidebar = (): JSX.Element => {
  const openAddModal = useBoundStore((s) => s.openAddModal)

  return (
    <aside className={styles.sidebar}>
      <Box p="4" className={styles.logo}>
        <Text size="4" weight="bold">
          My Financial Life
        </Text>
      </Box>

      <Box px="4" py="2">
        <IconButton size="3" highContrast className={styles.addButton} onClick={openAddModal}>
          <Plus size={20} />
          <Text size="2">Add</Text>
        </IconButton>
      </Box>

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
            <Flex align="center" gap="3" px="4" py="2">
              <item.icon size={20} />
              <Text size="2">{item.label}</Text>
            </Flex>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
