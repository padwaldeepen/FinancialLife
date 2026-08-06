import { useRef, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  Select,
  Badge,
  Dialog,
  Button,
  Table,
  VisuallyHidden,
} from '@radix-ui/themes'
import { Upload } from 'lucide-react'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { classifyImportType, type useCsvImport } from '../../../shared/hooks/useCsvImport.ts'
import styles from './Activity.module.css'

const MAPPING_FIELDS = [
  'date',
  'description',
  'amount',
  'type',
  'category',
  'merchant',
  'account',
  'notes',
] as const

interface Props {
  currency: string
  csv: ReturnType<typeof useCsvImport>
}

export const ImportDialog = ({ currency, csv }: Props): JSX.Element => {
  const importFileRef = useRef<HTMLInputElement>(null)
  const {
    importOpen,
    setImportOpen,
    importStep,
    setImportStep,
    importCsvHeaders,
    importCsvRows,
    importMapping,
    setImportMapping,
    importing,
    pendingReview,
    exactSkipped,
    resetImport,
    handleImportFile,
    handleImportConfirm,
    resolveReviewRow,
  } = csv

  return (
    <Dialog.Root
      open={importOpen}
      onOpenChange={(open) => {
        setImportOpen(open)
        if (!open) resetImport()
      }}
    >
      <Dialog.Content maxWidth="680px">
        <Dialog.Title>Import Transactions</Dialog.Title>
        <VisuallyHidden>
          <Dialog.Description>
            Upload, map, and review a CSV or Excel file of transactions to import
          </Dialog.Description>
        </VisuallyHidden>

        {importStep === 'upload' && (
          <Flex direction="column" gap="4" py="4" align="center">
            <Text size="2" color="gray">
              Upload a CSV or Excel (.xlsx) file with your transactions
            </Text>
            <input
              ref={importFileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImportFile(file)
              }}
            />
            <Button variant="soft" onClick={() => importFileRef.current?.click()}>
              <Upload size={14} /> Choose file
            </Button>
          </Flex>
        )}

        {importStep === 'map' && (
          <Flex direction="column" gap="3" py="3">
            <Text size="2" color="gray">
              Map CSV columns to transaction fields (* required)
            </Text>
            {MAPPING_FIELDS.map((field) => (
              <Flex key={field} align="center" gap="2">
                <Text size="2" className={styles.importFieldLabel}>
                  {field === 'date' || field === 'description' || field === 'amount'
                    ? `${field}*`
                    : field}
                </Text>
                <Select.Root
                  value={importMapping[field]}
                  onValueChange={(v) => setImportMapping({ ...importMapping, [field]: v })}
                >
                  <Select.Trigger className={styles.importFieldSelect} />
                  <Select.Content>
                    <Select.Item value="">— Skip —</Select.Item>
                    {importCsvHeaders.map((h) => (
                      <Select.Item key={h} value={h}>
                        {h}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>
            ))}
            <Flex gap="2" justify="end" mt="2">
              <Button
                variant="soft"
                onClick={() => {
                  setImportStep('upload')
                  resetImport()
                }}
              >
                Back
              </Button>
              <Button onClick={() => setImportStep('preview')}>Preview</Button>
            </Flex>
          </Flex>
        )}

        {importStep === 'preview' && (
          <Flex direction="column" gap="3" py="3">
            <Text size="2" color="gray">
              Preview — {importCsvRows.length} rows found
            </Text>
            <Box className={styles.importPreviewContainer}>
              <Table.Root size="1">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {importCsvRows.slice(0, 20).map((row, i) => {
                    const amtCol = importMapping.amount || ''
                    const typeCol = importMapping.type || ''
                    const dateCol = importMapping.date || ''
                    const descCol = importMapping.description || ''
                    const rawAmount = parseFloat((row[amtCol] || '0').replace(/[^0-9.-]/g, ''))
                    const txType = classifyImportType(row[typeCol] || '', rawAmount)
                    return (
                      <Table.Row key={i}>
                        <Table.Cell>{row[dateCol]}</Table.Cell>
                        <Table.Cell>{row[descCol]}</Table.Cell>
                        <Table.Cell>{formatCurrency(Math.abs(rawAmount), currency)}</Table.Cell>
                        <Table.Cell>
                          <Badge color={txType === 'income' ? 'green' : 'red'}>{txType}</Badge>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
            <Flex gap="2" justify="end" mt="2">
              <Button variant="soft" onClick={() => setImportStep('map')}>
                Back
              </Button>
              <Button onClick={handleImportConfirm} disabled={importing}>
                {importing ? 'Importing...' : `Import ${importCsvRows.length} transactions`}
              </Button>
            </Flex>
          </Flex>
        )}

        {importStep === 'review' && (
          <Flex direction="column" gap="3" py="3">
            <Text size="2" color="gray">
              {exactSkipped > 0 && `${exactSkipped} exact duplicates skipped automatically. `}
              {pendingReview.length} possible duplicate{pendingReview.length === 1 ? '' : 's'} need
              your review.
            </Text>
            <Flex direction="column" gap="3" className={styles.importPreviewContainer}>
              {pendingReview.map((row) => (
                <Box key={row.row_index} className={styles.row}>
                  <Flex direction="column" gap="2">
                    <Flex justify="between">
                      <Text weight="medium">{row.transaction.description}</Text>
                      <Text weight="bold">{formatCurrency(row.transaction.amount, currency)}</Text>
                    </Flex>
                    <Text size="1" color="gray">
                      Looks like — {row.matches[0]?.description} (
                      {formatCurrency(row.matches[0]?.amount ?? 0, currency)},{' '}
                      {Math.round((row.matches[0]?.similarity ?? 0) * 100)}% similar)
                    </Text>
                    <Flex gap="2" justify="end">
                      <Button
                        size="1"
                        variant="soft"
                        color="gray"
                        onClick={() => resolveReviewRow(row.row_index, 'skip')}
                      >
                        Skip
                      </Button>
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => resolveReviewRow(row.row_index, 'merge')}
                      >
                        Merge (keep existing)
                      </Button>
                      <Button
                        size="1"
                        variant="solid"
                        onClick={() => resolveReviewRow(row.row_index, 'keep-both')}
                      >
                        Keep both
                      </Button>
                    </Flex>
                  </Flex>
                </Box>
              ))}
            </Flex>
          </Flex>
        )}
      </Dialog.Content>
    </Dialog.Root>
  )
}
