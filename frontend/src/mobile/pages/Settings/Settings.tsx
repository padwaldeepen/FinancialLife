import { type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Flex, Text, Heading, Card, Switch, Button } from '@radix-ui/themes'
import { Moon, Sun, LogOut, User, Mail } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppTheme } from '../../../theme.tsx'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Settings.module.css'

export const Settings = (): JSX.Element => {
  const { user, logout } = useBoundStore(
    useShallow((s) => ({ user: s.auth.user, logout: s.logout })),
  )
  const { dark, toggle } = useAppTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <Box className={styles.page}>
      <Heading size="5" mb="4">
        Settings
      </Heading>

      <Box className={styles.section}>
        <Text size="1" weight="bold" color="gray" className={styles.sectionTitle}>
          Profile
        </Text>
        <Card className={styles.card}>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              <User size={18} />
              <Box className={styles.labelText}>
                <Text size="2">Name</Text>
                <Text size="2" color="gray">
                  {user?.name || 'Not set'}
                </Text>
              </Box>
            </Flex>
          </Box>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              <Mail size={18} />
              <Box className={styles.labelText}>
                <Text size="2">Email</Text>
                <Text size="2" color="gray">
                  {user?.email}
                </Text>
              </Box>
            </Flex>
          </Box>
        </Card>
      </Box>

      <Box className={styles.section}>
        <Text size="1" weight="bold" color="gray" className={styles.sectionTitle}>
          Appearance
        </Text>
        <Card className={styles.card}>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              {dark ? <Moon size={18} /> : <Sun size={18} />}
              <Box className={styles.labelText}>
                <Text size="2">Dark mode</Text>
                <Text size="1" color="gray">
                  {dark ? 'On' : 'Off'}
                </Text>
              </Box>
            </Flex>
            <Switch checked={dark} onCheckedChange={toggle} />
          </Box>
        </Card>
      </Box>

      <Box className={styles.section}>
        <Text size="1" weight="bold" color="gray" className={styles.sectionTitle}>
          Account
        </Text>
        <Card className={styles.card}>
          <Box className={styles.logoutRow}>
            <Button variant="soft" color="red" onClick={handleLogout}>
              <LogOut size={16} />
              Log out
            </Button>
          </Box>
        </Card>
      </Box>
    </Box>
  )
}
