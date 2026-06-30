import { type JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { Box, Flex, Text, Heading, Card } from '@radix-ui/themes'
import { Tags, Store, BarChart3, Settings, Target } from 'lucide-react'
import styles from './More.module.css'

interface MenuItem {
  to: string
  label: string
  icon: JSX.Element
}

const menuItems: MenuItem[] = [
  { to: '/goals', label: 'Goals', icon: <Target size={22} /> },
  { to: '/categories', label: 'Categories', icon: <Tags size={22} /> },
  { to: '/merchants', label: 'Merchants', icon: <Store size={22} /> },
  { to: '/reports', label: 'Reports', icon: <BarChart3 size={22} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={22} /> },
]

export const More = (): JSX.Element => {
  return (
    <Box className={styles.page}>
      <Heading size="5" mb="4">
        More
      </Heading>
      <Card>
        <Box className={styles.menuList}>
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={false}
              className={({ isActive }) =>
                `${styles.menuItem} ${isActive ? styles.menuItemActive : ''}`
              }
            >
              <Flex align="center" gap="3">
                {item.icon}
                <Text size="3">{item.label}</Text>
              </Flex>
            </NavLink>
          ))}
        </Box>
      </Card>
    </Box>
  )
}
