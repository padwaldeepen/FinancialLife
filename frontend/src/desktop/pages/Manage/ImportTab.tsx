import { type JSX } from 'react'
import { Box, Flex, Text, Card, Button } from '@radix-ui/themes'
import { Upload } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import { useCsvImport } from '../../../shared/hooks/useCsvImport.ts'
import { ImportDialog } from '../Activity/ImportDialog.tsx'
import styles from './Manage.module.css'

// Reuses the same `useCsvImport` hook + `ImportDialog` component Activity (U4) already
// mounts for its own quick-access "Import CSV" button — this is a second legitimate
// consumer of a shared hook, not duplicated logic (rules/dry.md). No `onImported`
// refetch target here (Manage doesn't show a transaction list); Activity re-fetches on
// its own mount the next time it's navigated to, same as after any other import.
export const ImportTab = (): JSX.Element => {
  const currency = useActiveCurrency()
  const { accounts } = useBoundStore(useShallow((s) => ({ accounts: s.accounts.items })))
  const csv = useCsvImport(accounts[0]?.id, () => {})

  return (
    <Box>
      <Text as="div" className={styles.sectionTitle} mb="3">
        Import
      </Text>
      <Card className={styles.card}>
        <Flex align="center" justify="between">
          <Box>
            <Text as="div" size="2" weight="medium">
              Import from CSV
            </Text>
            <Text as="div" size="2" color="gray">
              Map your bank's export columns to transactions, with duplicate detection.
            </Text>
          </Box>
          <Button variant="soft" onClick={() => csv.setImportOpen(true)}>
            <Upload size={14} /> Import CSV
          </Button>
        </Flex>
      </Card>
      <ImportDialog currency={currency} csv={csv} />
    </Box>
  )
}
