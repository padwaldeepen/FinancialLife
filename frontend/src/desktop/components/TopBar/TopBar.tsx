import { type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Button,
  Flex,
  IconButton,
  Popover,
  Separator,
  Switch,
  Text,
} from '@radix-ui/themes'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useAppTheme } from '../../../theme.tsx'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './TopBar.module.css'

export const TopBar = (): JSX.Element => {
  const { user, logout } = useBoundStore(
    useShallow((s) => ({ user: s.auth.user, logout: s.logout })),
  )
  const { dark, toggle } = useAppTheme()
  const navigate = useNavigate()

  const initial = user?.email?.charAt(0).toUpperCase() || 'U'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className={styles.topBar}>
      <Flex align="center" justify="end" px="4" height="100%">
        {' '}
        <Popover.Root>
          <Popover.Trigger>
            <IconButton variant="ghost" className={styles.trigger}>
              <Avatar size="2" radius="full" fallback={initial} />
            </IconButton>
          </Popover.Trigger>

          <Popover.Content align="end" className={styles.popoverContent}>
            <Flex direction="column" gap="3" p="2">
              <Flex direction="column" gap="1" px="2" pt="1">
                <Text size="2" weight="medium">
                  {user?.email}
                </Text>
              </Flex>

              <Separator size="4" />

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
      </Flex>
    </header>
  )
}
