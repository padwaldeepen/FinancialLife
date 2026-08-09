import { type JSX } from 'react'
import { Box, Tabs } from '@radix-ui/themes'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { Categories } from '../Categories/Categories.tsx'
import { Merchants } from '../Merchants/Merchants.tsx'
import { Goals } from '../Goals/Goals.tsx'
import { AccountsTab } from './AccountsTab.tsx'
import { ImportTab } from './ImportTab.tsx'
import { DocumentsTab } from './DocumentsTab.tsx'
import { AccountTab } from './AccountTab.tsx'
import { AdminTab } from './AdminTab.tsx'
import styles from './Manage.module.css'

// One home for every maintenance UI (U7) — retires the standalone Settings, Categories,
// Merchants, and Goals pages/routes. Categories/Merchants/Goals are rendered here as the
// SAME components those old routes used (not reimplemented) — each is already a
// self-contained CRUD page wired to its own store slice, so mounting it as a tab panel
// costs nothing and avoids re-deriving ~1400 lines of working, tested logic.
export const Manage = (): JSX.Element => {
  const isAdmin = useBoundStore((s) => s.auth.user?.is_admin ?? false)

  return (
    <Box>
      <Tabs.Root defaultValue="accounts">
        <Tabs.List className={styles.tabList}>
          <Tabs.Trigger value="accounts">Accounts</Tabs.Trigger>
          <Tabs.Trigger value="categories">Categories</Tabs.Trigger>
          <Tabs.Trigger value="merchants">Merchants</Tabs.Trigger>
          <Tabs.Trigger value="goals">Goals</Tabs.Trigger>
          <Tabs.Trigger value="import">Import</Tabs.Trigger>
          <Tabs.Trigger value="documents">Documents</Tabs.Trigger>
          <Tabs.Trigger value="account">Account</Tabs.Trigger>
          {isAdmin && <Tabs.Trigger value="admin">Admin</Tabs.Trigger>}
        </Tabs.List>

        <Box className={styles.tabContent}>
          <Tabs.Content value="accounts">
            <AccountsTab />
          </Tabs.Content>
          <Tabs.Content value="categories">
            <Categories />
          </Tabs.Content>
          <Tabs.Content value="merchants">
            <Merchants />
          </Tabs.Content>
          <Tabs.Content value="goals">
            <Goals />
          </Tabs.Content>
          <Tabs.Content value="import">
            <ImportTab />
          </Tabs.Content>
          <Tabs.Content value="documents">
            <DocumentsTab />
          </Tabs.Content>
          <Tabs.Content value="account">
            <AccountTab />
          </Tabs.Content>
          {isAdmin && (
            <Tabs.Content value="admin">
              <AdminTab />
            </Tabs.Content>
          )}
        </Box>
      </Tabs.Root>
    </Box>
  )
}
