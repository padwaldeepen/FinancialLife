import { useEffect, type JSX } from 'react'
import { Box, Flex, Text, Card, Switch } from '@radix-ui/themes'
import { Sparkles } from 'lucide-react'
import toast from '../../../shared/utils/toast.ts'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Manage.module.css'

// Ollama endpoint config (the other half of this tab per U7's Build line) is
// deliberately NOT built here: no backend field exists to persist it and no code path
// consumes it yet (S1/S2/T6, which introduce the actual local Ollama client, haven't
// landed) — an input with nowhere for the value to go is exactly the "no half-finished
// implementations" pattern to avoid. Flagged for whichever of S1/S2/T6 lands the
// Ollama client to add here.
export const AiPrivacyTab = (): JSX.Element => {
  const { user, fetchCurrentUser, updateAiCloudEnabled } = useBoundStore(
    useShallow((s) => ({
      user: s.auth.user,
      fetchCurrentUser: s.fetchCurrentUser,
      updateAiCloudEnabled: s.updateAiCloudEnabled,
    })),
  )

  useEffect(() => {
    if (user && user.ai_cloud_enabled === undefined) fetchCurrentUser()
  }, [user, fetchCurrentUser])

  const handleToggle = async (enabled: boolean) => {
    try {
      await updateAiCloudEnabled(enabled)
      toast.success(enabled ? 'Cloud AI enabled for your account' : 'Cloud AI disabled')
    } catch {
      toast.error('Could not update AI settings')
    }
  }

  return (
    <Box>
      <Text as="div" className={styles.sectionTitle} mb="3">
        AI &amp; Privacy
      </Text>
      <Card className={styles.card}>
        <Box className={styles.row}>
          <Flex className={styles.labelGroup}>
            <Sparkles size={18} />
            <Box className={styles.labelText}>
              <Text size="2" weight="medium">
                Cloud AI (Gemini)
              </Text>
              <Text size="2" color="gray">
                When on, your financial text and scanned documents are sent to Google&apos;s AI
                service; the free tier may use them to train models. When off, nothing ever leaves
                this machine.
              </Text>
            </Box>
          </Flex>
          <Switch checked={Boolean(user?.ai_cloud_enabled)} onCheckedChange={handleToggle} />
        </Box>
      </Card>
    </Box>
  )
}
