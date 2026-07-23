import { useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Flex, Text, Card, Button, TextField } from '@radix-ui/themes'
import { User, Mail, LogOut, Plus } from 'lucide-react'
import toast from '../../../shared/utils/toast.ts'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { useProfileSwitch } from '../../../shared/hooks/useProfileSwitch.ts'
import { COUNTRY_FLAG, COUNTRY_NAME } from '../../../shared/utils/countries.ts'
import styles from './Manage.module.css'

export const AccountTab = (): JSX.Element => {
  const { user, logout, changePassword } = useBoundStore(
    useShallow((s) => ({ user: s.auth.user, logout: s.logout, changePassword: s.changePassword })),
  )
  const { profiles, activeProfileId, addableCountries, switchProfile, addProfile } =
    useProfileSwitch()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    setChangingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast.success('Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: unknown) {
      const detail =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined
      toast.error(detail || 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <Box>
      <Text as="div" className={styles.sectionTitle} mb="3">
        Profile
      </Text>
      <Card className={styles.card} mb="5">
        <Box className={styles.row}>
          <Flex className={styles.labelGroup}>
            <User size={18} />
            <Box className={styles.labelText}>
              <Text size="2">Name</Text>
              <Text size="2" color="gray">
                {user?.name || user?.full_name || 'Not set'}
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

      <Text as="div" className={styles.sectionTitle} mb="3">
        Countries
      </Text>
      <Card className={styles.card} mb="5">
        {profiles.map((profile) => (
          <Box key={profile.id} className={styles.row}>
            <Flex className={styles.labelGroup}>
              <Text size="4">{COUNTRY_FLAG[profile.country]}</Text>
              <Box className={styles.labelText}>
                <Text size="2">
                  {COUNTRY_NAME[profile.country]}
                  {profile.id === activeProfileId && (
                    <Text size="1" color="gray">
                      {' '}
                      (active)
                    </Text>
                  )}
                </Text>
                <Text size="2" color="gray">
                  {profile.currency}
                </Text>
              </Box>
            </Flex>
            {profile.id !== activeProfileId && (
              <Button size="1" variant="soft" onClick={() => switchProfile(profile.id)}>
                Switch
              </Button>
            )}
          </Box>
        ))}
        {addableCountries.map((country) => (
          <Box key={country} className={styles.row}>
            <Flex className={styles.labelGroup}>
              <Text size="4">{COUNTRY_FLAG[country]}</Text>
              <Text size="2" color="gray">
                {COUNTRY_NAME[country]}
              </Text>
            </Flex>
            <Button size="1" variant="soft" onClick={() => addProfile(country)}>
              <Plus size={14} /> Add
            </Button>
          </Box>
        ))}
      </Card>

      <Text as="div" className={styles.sectionTitle} mb="3">
        Password
      </Text>
      <Card className={styles.card} mb="5">
        <Flex direction="column" gap="3">
          <TextField.Root
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <TextField.Root
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <TextField.Root
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button
            onClick={handleChangePassword}
            loading={changingPassword}
            disabled={!currentPassword || !newPassword || !confirmPassword}
            style={{ alignSelf: 'flex-start' }}
          >
            Update Password
          </Button>
        </Flex>
      </Card>

      <Text as="div" className={styles.sectionTitle} mb="3">
        Account
      </Text>
      <Card className={styles.card}>
        <Button variant="soft" color="red" onClick={handleLogout}>
          <LogOut size={16} />
          Log out
        </Button>
      </Card>
    </Box>
  )
}
