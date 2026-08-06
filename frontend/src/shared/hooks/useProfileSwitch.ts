import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../store/useBoundStore.ts'
import type { Country, Profile } from '../../shared/types/user.ts'

// Every country a user could ever have a profile for — the one place this list is
// defined (was previously copy-pasted in TopBar.tsx, Manage/AccountTab.tsx, and
// mobile Home.tsx).
const ADDABLE_COUNTRIES: Country[] = ['US', 'IN', 'CA']

interface UseProfileSwitchResult {
  profiles: Profile[]
  activeProfileId: number | null
  addableCountries: Country[]
  switchProfile: (profileId: number) => void
  addProfile: (country: Country) => Promise<void>
}

// Switching profiles swaps the entire financial world (docs/architecture-and-goals.md
// "Country & currency rules") — every slice (accounts, transactions, bills, reports,
// goals, categories, ...) is scoped to the old profile and would otherwise keep
// showing it. A full reload is the only way to guarantee nothing bleeds across
// profiles without hand-invalidating every slice individually (U3).
export const useProfileSwitch = (): UseProfileSwitchResult => {
  const { profiles, activeProfileId, setActiveProfile, addProfile } = useBoundStore(
    useShallow((s) => ({
      profiles: s.auth.profiles,
      activeProfileId: s.auth.activeProfileId,
      setActiveProfile: s.auth.setActiveProfile,
      addProfile: s.auth.addProfile,
    })),
  )

  const switchProfile = (profileId: number) => {
    if (profileId === activeProfileId) return
    setActiveProfile(profileId)
    window.location.reload()
  }

  // addProfile's own action already switches activeProfileId to the new profile —
  // without a reload, every already-mounted slice (accounts, transactions, ...) keeps
  // showing the OLD profile's data under the new profile's currency, the exact
  // cross-profile bleed the sealed-profile model forbids.
  const addProfileAndSwitch = async (country: Country) => {
    await addProfile(country)
    window.location.reload()
  }

  const addableCountries = ADDABLE_COUNTRIES.filter((c) => !profiles.some((p) => p.country === c))

  return {
    profiles,
    activeProfileId,
    addableCountries,
    switchProfile,
    addProfile: addProfileAndSwitch,
  }
}
