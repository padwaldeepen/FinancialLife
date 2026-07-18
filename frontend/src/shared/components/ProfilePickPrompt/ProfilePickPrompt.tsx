import { type JSX } from 'react'
import { AlertDialog, Flex, Text, Button } from '@radix-ui/themes'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { COUNTRY_FLAG, COUNTRY_NAME } from '../../utils/countries.ts'

// Shown once, right after login/register, only when the user has 2+ profiles and
// never made an explicit choice before (rules/frontend.md's "no shared/components/"
// exception: this is cross-device logic — an identical one-time gate — not a
// device-specific layout, so one implementation for both trees is correct, not a
// DRY violation).
export const ProfilePickPrompt = (): JSX.Element | null => {
  const { needsProfilePick, profiles, setActiveProfile } = useBoundStore(
    useShallow((s) => ({
      needsProfilePick: s.auth.needsProfilePick,
      profiles: s.auth.profiles,
      setActiveProfile: s.setActiveProfile,
    })),
  )

  if (!needsProfilePick) return null

  // Home (and whatever else is already mounted underneath this dialog) started
  // fetching under the auto-resolved default profile the instant the app loaded —
  // before the user's actual pick lands here. A full reload, not just `setActiveProfile`,
  // is required even if they pick the same profile the auto-resolver already chose,
  // otherwise anything fetched during that window can leak across profiles.
  const choose = (profileId: number) => {
    setActiveProfile(profileId)
    window.location.reload()
  }

  return (
    <AlertDialog.Root open>
      <AlertDialog.Content maxWidth="360px">
        <AlertDialog.Title>Which country?</AlertDialog.Title>
        <AlertDialog.Description size="2" color="gray">
          You have more than one profile. Pick which one to start in — you can switch anytime.
        </AlertDialog.Description>
        <Flex direction="column" gap="2" mt="4">
          {profiles.map((profile) => (
            <AlertDialog.Action key={profile.id}>
              <Button
                variant="soft"
                size="3"
                onClick={() => choose(profile.id)}
                style={{ justifyContent: 'flex-start' }}
              >
                <Text size="4">{COUNTRY_FLAG[profile.country]}</Text>
                <Text>
                  {COUNTRY_NAME[profile.country]} ({profile.currency})
                </Text>
              </Button>
            </AlertDialog.Action>
          ))}
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  )
}
