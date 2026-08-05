import { useEffect, useState, type JSX } from 'react'
import { Box, Flex, Text, Dialog, Button, Table, Checkbox, Badge, Select } from '@radix-ui/themes'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import toast from '../../../shared/utils/toast.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import type { PendingDocument, StatementRow } from '../../../store/slices/documentsSlice.ts'
import styles from './Activity.module.css'

interface Props {
  document: PendingDocument
  onClose: () => void
}

const dedupBadge: Record<StatementRow['dedup_status'], { label: string; color?: 'gray' | 'red' }> =
  {
    none: { label: 'New', color: 'gray' },
    fuzzy: { label: 'Possible dup' },
    exact: { label: 'Already have it', color: 'red' },
  }

// S4: the multi-row statement review — a table of every extracted transaction, each with
// an include checkbox and a dedup verdict. Exact duplicates start UNCHECKED (re-importing
// overlapping months must not double-count); new rows start checked. The account is
// chosen once for the whole statement, and changing it re-runs dedup (it's account-scoped).
export const StatementReviewDialog = ({ document: doc, onClose }: Props): JSX.Element => {
  const currency = useActiveCurrency()
  const { accounts, categories, fetchStatementRows, importStatement, fetchTransactions } =
    useBoundStore(
      useShallow((s) => ({
        accounts: s.accounts.items,
        categories: s.categories.flat,
        fetchStatementRows: s.fetchStatementRows,
        importStatement: s.importStatement,
        fetchTransactions: s.fetchTransactions,
      })),
    )

  const [accountId, setAccountId] = useState<string>(accounts[0] ? String(accounts[0].id) : '')
  const [rows, setRows] = useState<StatementRow[]>([])
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [tier, setTier] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetchStatementRows(doc.id, Number(accountId))
        if (cancelled) return
        setRows(res.rows)
        setTier(res.tier)
        // Default: import everything that isn't an exact duplicate.
        setChecked(
          Object.fromEntries(res.rows.map((r) => [r.row_index, r.dedup_status !== 'exact'])),
        )
      } catch {
        if (!cancelled) toast.error('Could not read the statement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    // Guard against a fast account switch resolving out of order / after unmount.
    return () => {
      cancelled = true
    }
  }, [doc.id, accountId, fetchStatementRows])

  const selectedCount = rows.filter((r) => checked[r.row_index]).length

  const handleImport = async () => {
    const toImport = rows.filter((r) => checked[r.row_index])
    if (toImport.length === 0) {
      toast.error('Select at least one transaction to import')
      return
    }
    setSaving(true)
    try {
      const result = await importStatement(
        doc.id,
        Number(accountId),
        toImport.map((r) => ({
          date: r.date ? `${r.date}T00:00:00` : new Date().toISOString(),
          description: r.description,
          amount: r.amount,
          transaction_type: r.transaction_type,
          category_id: r.category_id,
          // A fuzzy row the user deliberately kept checked = "keep both".
          skip_dedup: r.dedup_status === 'fuzzy',
        })),
      )
      toast.success(
        `Imported ${result.imported} transaction${result.imported === 1 ? '' : 's'}` +
          (result.skipped ? `, skipped ${result.skipped} duplicate(s)` : ''),
      )
      fetchTransactions({ reset: true, force: true })
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to import statement')
    } finally {
      setSaving(false)
    }
  }

  const categoryName = (id: number | null) =>
    id == null ? '—' : (categories.find((c) => c.id === id)?.name ?? '—')

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="820px">
        <Dialog.Title>Review Statement</Dialog.Title>

        <Flex align="center" gap="3" mt="2" mb="3">
          <Text size="2" color="gray">
            Import into
          </Text>
          <Select.Root value={accountId} onValueChange={setAccountId}>
            <Select.Trigger placeholder="Choose an account" />
            <Select.Content>
              {accounts.map((a) => (
                <Select.Item key={a.id} value={String(a.id)}>
                  {a.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          {tier && (
            <Text size="1" color="gray">
              Extracted via {tier}
            </Text>
          )}
        </Flex>

        {loading ? (
          <Box className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-3)' }} />
        ) : rows.length === 0 ? (
          <Box className={styles.emptyState}>
            <Text color="gray" size="2">
              No transactions could be read from this statement. Try enabling cloud AI in Settings
              for tougher layouts, or add them manually.
            </Text>
          </Box>
        ) : (
          <Box className={styles.importPreviewContainer}>
            <Table.Root size="1">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Category</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell align="right">Amount</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((r) => {
                  const badge = dedupBadge[r.dedup_status]
                  return (
                    <Table.Row key={r.row_index}>
                      <Table.Cell>
                        <Checkbox
                          checked={!!checked[r.row_index]}
                          onCheckedChange={(v) => setChecked((c) => ({ ...c, [r.row_index]: !!v }))}
                        />
                      </Table.Cell>
                      <Table.Cell>{r.date ?? '—'}</Table.Cell>
                      <Table.Cell>{r.description}</Table.Cell>
                      <Table.Cell>{categoryName(r.category_id)}</Table.Cell>
                      <Table.Cell align="right">
                        <Text color={r.transaction_type === 'income' ? 'green' : undefined}>
                          {r.transaction_type === 'income' ? '+' : ''}
                          {formatCurrency(r.amount, currency)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        {r.dedup_status !== 'none' && (
                          <Badge size="1" color={badge.color}>
                            {badge.label}
                          </Badge>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        )}

        <Flex justify="between" align="center" mt="4">
          <Text size="2" color="gray">
            {selectedCount} of {rows.length} selected
          </Text>
          <Flex gap="2">
            <Button variant="soft" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={saving || selectedCount === 0}>
              Import {selectedCount || ''}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
