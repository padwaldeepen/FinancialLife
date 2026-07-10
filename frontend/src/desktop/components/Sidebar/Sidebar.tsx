import { type JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { Box } from '@radix-ui/themes'
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
      <Box className={styles.logo}>
        <div className={styles.logoIcon}>F</div>
        <span className={styles.logoText}>My Financial Life</span>
      </Box>

      <button className={styles.addButton} onClick={openAddModal}>
        <Plus size={18} />
        Add Transaction
      </button>

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
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
