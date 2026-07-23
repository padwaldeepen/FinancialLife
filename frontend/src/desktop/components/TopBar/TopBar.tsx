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
import { LogOut, Moon, Sun, Plus } from 'lucide-react'
import { useAppTheme } from '../../../theme.tsx'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { useProfileSwitch } from '../../../shared/hooks/useProfileSwitch.ts'
import { COUNTRY_FLAG, COUNTRY_NAME } from '../../../shared/utils/countries.ts'
import styles from './TopBar.module.css'

export const TopBar = (): JSX.Element => {
  const { user, logout } = useBoundStore(
    useShallow((s) => ({ user: s.auth.user, logout: s.logout })),
  )
  const { dark, toggle } = useAppTheme()
  const { profiles, activeProfileId, addableCountries, switchProfile, addProfile } =
    useProfileSwitch()
  const navigate = useNavigate()

  const initial = user?.email?.charAt(0).toUpperCase() || 'U'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className={styles.topBar}>
      <Flex align="center" justify="end" px="4" height="100%">
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

              {profiles.length > 0 && (
                <>
                  <Separator size="4" />
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
                </>
              )}

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
