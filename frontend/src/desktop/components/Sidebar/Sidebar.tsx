import { type JSX } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Avatar, Box, Text, Button, Flex, Popover, Separator, Switch } from '@radix-ui/themes'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Repeat,
  BarChart3,
  Settings,
  Plus,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppTheme } from '../../../theme.tsx'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { useProfileSwitch } from '../../../shared/hooks/useProfileSwitch.ts'
import { COUNTRY_FLAG, COUNTRY_NAME } from '../../../shared/utils/countries.ts'
import styles from './Sidebar.module.css'

const navItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/activity', label: 'Activity', icon: ArrowLeftRight },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/manage', label: 'Manage', icon: Settings },
]

export const Sidebar = (): JSX.Element => {
  const openAddModal = useBoundStore((s) => s.ui.openAddModal)
  const { user, logout } = useBoundStore(
    useShallow((s) => ({ user: s.auth.user, logout: s.auth.logout })),
  )
  const { dark, toggle } = useAppTheme()
  const { profiles, activeProfileId, addableCountries, switchProfile, addProfile } =
    useProfileSwitch()
  const navigate = useNavigate()

  const displayName = user?.full_name || user?.username || user?.email
  const initial = displayName?.charAt(0).toUpperCase() || 'U'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

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

      <Box className={styles.footer}>
        <Popover.Root>
          <Popover.Trigger>
            <button className={styles.profileTrigger}>
              <Avatar size="2" radius="full" fallback={initial} />
              <Text size="2" weight="medium" className={styles.profileTriggerName}>
                {displayName}
              </Text>
            </button>
          </Popover.Trigger>

          <Popover.Content align="start" side="top" className={styles.popoverContent}>
            <Flex direction="column" gap="3" p="2">
              {profiles.length > 0 && (
                <>
                  <Flex direction="column" gap="1" px="2">
                    <Text size="1" color="gray" weight="medium">
                      Profile
                    </Text>
                    {profiles.map((profile) => (
                      <Flex
                        key={profile.id}
                        align="center"
                        justify="between"
                        className={styles.profileRow}
                        data-active={profile.id === activeProfileId}
                        onClick={() => switchProfile(profile.id)}
                      >
                        <Flex align="center" gap="2">
                          <Text size="3">{COUNTRY_FLAG[profile.country]}</Text>
                          <Text size="2">{COUNTRY_NAME[profile.country]}</Text>
                        </Flex>
                        <Text size="1" color="gray">
                          {profile.currency}
                        </Text>
                      </Flex>
                    ))}
                    {addableCountries.map((country) => (
                      <Flex
                        key={country}
                        align="center"
                        gap="2"
                        className={styles.profileRow}
                        onClick={() => addProfile(country)}
                      >
                        <Plus size={14} />
                        <Text size="2" color="gray">
                          Add {COUNTRY_NAME[country]}
                        </Text>
                      </Flex>
                    ))}
                  </Flex>
                  <Separator size="4" />
                </>
              )}

              <Flex align="center" justify="between" px="2" className={styles.themeRow}>
                <Flex align="center" gap="2">
                  {dark ? <Moon size={16} /> : <Sun size={16} />}
                  <Text size="2">Dark mode</Text>
                </Flex>
                <Switch checked={dark} onCheckedChange={toggle} />
              </Flex>

              <Separator size="4" />

              <Button
                variant="ghost"
                color="red"
                onClick={handleLogout}
                className={styles.logoutButton}
              >
                <LogOut size={16} />
                <Text size="2">Log out</Text>
              </Button>
            </Flex>
          </Popover.Content>
        </Popover.Root>
      </Box>
    </aside>
  )
}
