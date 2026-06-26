import { type JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { Flex, Text } from '@radix-ui/themes'
import { LayoutDashboard, ArrowLeftRight, PlusCircle, PiggyBank, User } from 'lucide-react'
import styles from './BottomTabBar.module.css'

const tabs = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/add', label: '', icon: PlusCircle, isAdd: true },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/profile', label: 'Profile', icon: User },
]

export const BottomTabBar = (): JSX.Element => {
  return (
    <nav className={styles.bar}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `${styles.tab} ${isActive && !tab.isAdd ? styles.tabActive : ''} ${tab.isAdd ? styles.addTab : ''}`
          }
        >
          <Flex direction="column" align="center" gap="1">
            <tab.icon size={tab.isAdd ? 28 : 22} />
            {tab.label && (
              <Text size="1" className={styles.label}>
                {tab.label}
              </Text>
            )}
          </Flex>
        </NavLink>
      ))}
    </nav>
  )
}
