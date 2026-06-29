import { type JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { Box, Flex, Text } from '@radix-ui/themes'
import { LayoutDashboard, ArrowLeftRight, PiggyBank, Settings } from 'lucide-react'
import styles from './Sidebar.module.css'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const Sidebar = (): JSX.Element => {
  return (
    <aside className={styles.sidebar}>
      <Box p="4" className={styles.logo}>
        <Text size="4" weight="bold">
          My Financial Life
        </Text>
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
