import { useEffect, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  TextField,
  Select,
  Badge,
  IconButton,
  Button,
  Checkbox,
  Skeleton,
} from '@radix-ui/themes'
import { Search, Trash2, Calendar, Download, Upload, FileUp, Paperclip } from 'lucide-react'
import { format, isToday, isYesterday, parseISO, startOfWeek } from 'date-fns'
import toast from '../../../shared/utils/toast.ts'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import api from '../../../shared/api/client.ts'
import { formatCurrency, getAmountColor } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import { useTransactionFilters } from '../../../shared/hooks/useTransactionFilters.ts'
import { useTransactionList } from '../../../shared/hooks/useTransactionList.ts'
import { useCsvImport } from '../../../shared/hooks/useCsvImport.ts'
import type { Transaction } from '../../../store/slices/transactionsSlice.ts'
import { TransactionDetailDialog } from './TransactionDetailDialog.tsx'
import { ImportDialog } from './ImportDialog.tsx'
import { DocumentUploadDialog } from './DocumentUploadDialog.tsx'
import { PendingReceipts } from './PendingReceipts.tsx'
import { DocumentViewerDialog } from './DocumentViewerDialog.tsx'
import styles from './Activity.module.css'
import shared from '../../styles/shared.module.css'

type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'earlier'

const groupLabel: Record<DateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  earlier: 'Earlier',
}

function getDateGroup(dateStr: string): DateGroup {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'today'
  if (isYesterday(d)) return 'yesterday'
  if (d >= startOfWeek(new Date())) return 'thisWeek'
  return 'earlier'
}

export const Activity = (): JSX.Element => {
  const currency = useActiveCurrency()
  const {
    filters,
    setSearch,
    setTypeFilter,
    setCategoryFilter,
    setMerchantFilter,
    setStartDate,
    setEndDate,
    categories,
    merchants,
  } = useTransactionFilters()
  const {
    items: transactions,
    loading,
    loadingMore,
    sentinelRef,
    deleteTransaction,
    updateNotes,
    saveTransaction,
    refetch,
  } = useTransactionList(filters)
  const {
    accounts,
    fetchAccounts,
    bills,
    fetchBills,
    linkTransactionToBill,
    unlinkTransactionFromBill,
  } = useBoundStore(
    useShallow((s) => ({
      accounts: s.accounts.items,
      fetchAccounts: s.accounts.fetchAccounts,
      bills: s.bills.items,
      fetchBills: s.bills.fetchBills,
      linkTransactionToBill: s.bills.linkTransactionToBill,
      unlinkTransactionFromBill: s.bills.unlinkTransactionFromBill,
    })),
  )

  useEffect(() => {
    fetchAccounts()
    fetchBills()
  }, [fetchAccounts, fetchBills])

  const {
    selectedId,
    selectMode,
    documentUploadOpen,
    viewingDocumentId,
    selectedIds,
    bulkCategory,
    bulkAccount,
    bulkApplying,
    setActivitySelectedId,
    toggleActivitySelectMode,
    toggleActivitySelected,
    setActivityDocumentUploadOpen,
    setActivityViewingDocumentId,
    setActivityBulkCategory,
    setActivityBulkAccount,
    setActivityBulkApplying,
    resetActivityBulkEdit,
  } = useBoundStore(useShallow((s) => s.activityPage))

  const csv = useCsvImport(accounts[0]?.id, refetch)
  const selected = transactions.find((t) => t.id === selectedId) || null

  const toggleSelect = toggleActivitySelected

  const applyBulkEdit = async () => {
    if (!bulkCategory && !bulkAccount) return
    setActivityBulkApplying(true)
    const data: Partial<Transaction> = {}
    if (bulkCategory) data.category_id = Number(bulkCategory)
    if (bulkAccount) data.account_id = Number(bulkAccount)
    const results = await Promise.all([...selectedIds].map((id) => saveTransaction(id, data)))
    const failed = results.filter((ok) => !ok).length
    if (failed > 0) toast.error(`${failed} of ${results.length} rows failed to update`)
    else toast.success(`Updated ${selectedIds.size} transactions`)
    resetActivityBulkEdit()
  }

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {}
      if (filters.startDate) params.date_from = filters.startDate
      if (filters.endDate) params.date_to = filters.endDate
      const res = await api.get('/api/export/csv', { params, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `my-financial-life-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch {
      toast.error('Export failed')
    }
  }

  const grouped: Record<DateGroup, Transaction[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }
  for (const t of transactions) grouped[getDateGroup(t.date)].push(t)

  return (
    <Box>
      <TextField.Root
        className={styles.searchInput}
        mb="3"
        placeholder="Search transactions..."
        value={filters.search}
        onChange={(e) => setSearch(e.target.value)}
      >
        <TextField.Slot side="left">
          <Search size={16} />
        </TextField.Slot>
      </TextField.Root>

      <Flex className={styles.filterBar} mb="4" direction="column" gap="3">
        <Flex gap="2" align="center" wrap="wrap">
          <Text size="1" color="gray" className={styles.resultCount}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </Text>
          <Select.Root value={filters.typeFilter} onValueChange={setTypeFilter}>
            <Select.Trigger className={styles.filterBarSelect} placeholder="All types" />
            <Select.Content>
              <Select.Item value="">All types</Select.Item>
              <Select.Item value="income">Income</Select.Item>
              <Select.Item value="expense">Expense</Select.Item>
            </Select.Content>
          </Select.Root>

          <Select.Root value={filters.categoryFilter} onValueChange={setCategoryFilter}>
            <Select.Trigger className={styles.filterBarSelect} placeholder="All categories" />
            <Select.Content>
              <Select.Item value="">All categories</Select.Item>
              {categories.map((c) => (
                <Select.Item key={c.id} value={String(c.id)}>
                  {c.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Select.Root value={filters.merchantFilter} onValueChange={setMerchantFilter}>
            <Select.Trigger className={styles.filterBarSelect} placeholder="All merchants" />
            <Select.Content>
              <Select.Item value="">All merchants</Select.Item>
              {merchants.map((m) => (
                <Select.Item key={m.id} value={String(m.id)}>
                  {m.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <TextField.Root
            type="date"
            aria-label="Filter start date"
            value={filters.startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={styles.dateInput}
          >
            <TextField.Slot side="left">
              <Calendar size={14} />
            </TextField.Slot>
          </TextField.Root>
          <Text size="1" color="gray">
            to
          </Text>
          <TextField.Root
            type="date"
            aria-label="Filter end date"
            value={filters.endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={styles.dateInput}
          >
            <TextField.Slot side="left">
              <Calendar size={14} />
            </TextField.Slot>
          </TextField.Root>
        </Flex>

        <Flex gap="2" justify="end" wrap="wrap">
          <Button variant="soft" color="gray" size="2" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </Button>
          <Button variant="soft" color="gray" size="2" onClick={() => csv.setImportOpen(true)}>
            <Upload size={14} /> Import
          </Button>
          <Button
            variant="soft"
            color="gray"
            size="2"
            onClick={() => setActivityDocumentUploadOpen(true)}
          >
            <FileUp size={14} /> Upload Receipt
          </Button>
          <Button
            variant={selectMode ? 'solid' : 'soft'}
            color="gray"
            highContrast={selectMode}
            size="2"
            onClick={toggleActivitySelectMode}
          >
            {selectMode ? 'Cancel select' : 'Select'}
          </Button>
        </Flex>
      </Flex>

      {selectMode && selectedIds.size > 0 && (
        <Flex className={styles.filterBar} mb="4" align="center" gap="2">
          <Text size="2" weight="medium">
            {selectedIds.size} selected
          </Text>
          <Select.Root value={bulkCategory} onValueChange={setActivityBulkCategory}>
            <Select.Trigger className={styles.filterBarSelect} placeholder="Set category" />
            <Select.Content>
              {categories.map((c) => (
                <Select.Item key={c.id} value={String(c.id)}>
                  {c.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          <Select.Root value={bulkAccount} onValueChange={setActivityBulkAccount}>
            <Select.Trigger className={styles.filterBarSelect} placeholder="Set account" />
            <Select.Content>
              {accounts.map((a) => (
                <Select.Item key={a.id} value={String(a.id)}>
                  {a.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          <Button
            size="2"
            onClick={applyBulkEdit}
            disabled={bulkApplying || (!bulkCategory && !bulkAccount)}
          >
            Apply
          </Button>
        </Flex>
      )}

      <PendingReceipts />

      {loading && transactions.length === 0 ? (
        <Flex className={shared.emptyState} direction="column" gap="3">
          <Skeleton>
            <Text as="div" size="2">
              Placeholder transaction line of typical length for loading state
            </Text>
          </Skeleton>
          <Skeleton>
            <Text as="div" size="2">
              Shorter placeholder line
            </Text>
          </Skeleton>
          <Skeleton>
            <Text as="div" size="2">
              Shortest line
            </Text>
          </Skeleton>
        </Flex>
      ) : transactions.length === 0 ? (
        <Flex className={shared.emptyState} direction="column">
          <Text as="div" className={shared.emptyTitle}>
            No transactions yet
          </Text>
          <Text as="div" className={shared.emptyHint}>
            Add one using the quick-add feature
          </Text>
        </Flex>
      ) : (
        <Box>
          {(Object.entries(grouped) as [DateGroup, Transaction[]][]).map(([group, items]) =>
            items.length > 0 ? (
              <Box key={group} mb="4">
                <Text as="div" className={styles.groupHeader}>
                  {groupLabel[group]}
                </Text>
                {items.map((t) => (
                  <Flex
                    key={t.id}
                    className={styles.row}
                    align="center"
                    justify="between"
                    onClick={() => (selectMode ? toggleSelect(t.id) : setActivitySelectedId(t.id))}
                  >
                    {selectMode && (
                      <Checkbox
                        checked={selectedIds.has(t.id)}
                        onCheckedChange={() => toggleSelect(t.id)}
                        onClick={(e) => e.stopPropagation()}
                        mr="3"
                      />
                    )}
                    <Flex direction="column" gap="1" className={styles.txContent}>
                      <Text as="div" className={styles.txDescription}>
                        {t.description}
                      </Text>
                      <Flex className={styles.txMeta} gap="2" align="center">
                        {t.merchant_name && (
                          <Text size="1" color="gray">
                            {t.merchant_name}
                          </Text>
                        )}
                        {t.category_name && (
                          <Badge color={(t.category_color as 'gray') || 'gray'} size="1">
                            {t.category_name}
                          </Badge>
                        )}
                        <Text size="1" color="gray">
                          {format(parseISO(t.date), 'MMM d')}
                        </Text>
                        {t.document_id != null && (
                          <Paperclip
                            size={12}
                            color="var(--gray-9)"
                            aria-label="View source document"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActivityViewingDocumentId(t.document_id!)
                            }}
                          />
                        )}
                      </Flex>
                    </Flex>
                    <Flex align="center" gap="3" className={styles.txActions}>
                      <Text
                        className={styles.txAmount}
                        style={{ color: getAmountColor(t.transaction_type) }}
                      >
                        {t.transaction_type === 'income' ? '+' : '-'}
                        {formatCurrency(t.amount, currency)}
                      </Text>
                      {!selectMode && (
                        <IconButton
                          variant="ghost"
                          size="1"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteTransaction(t.id)
                          }}
                          aria-label="Delete"
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      )}
                    </Flex>
                  </Flex>
                ))}
              </Box>
            ) : null,
          )}
          {loadingMore && (
            <Box className={styles.loadingMore}>
              <Text color="gray" size="2">
                Loading more...
              </Text>
            </Box>
          )}
          <Box ref={sentinelRef} style={{ height: 1 }} />
        </Box>
      )}

      {selected && (
        <TransactionDetailDialog
          transaction={selected}
          currency={currency}
          categories={categories}
          merchants={merchants}
          accounts={accounts}
          bills={bills}
          open={!!selected}
          onOpenChange={(open) => !open && setActivitySelectedId(null)}
          onClose={() => setActivitySelectedId(null)}
          onDelete={deleteTransaction}
          onSaveNotes={updateNotes}
          onSaveEdit={saveTransaction}
          onLinkBill={async (billId) => {
            try {
              await linkTransactionToBill(billId, selected.id)
              refetch()
            } catch {
              // toast handled in store
            }
          }}
          onUnlinkBill={async () => {
            if (!selected.bill_id) return
            try {
              await unlinkTransactionFromBill(selected.bill_id, selected.id)
              refetch()
            } catch {
              // toast handled in store
            }
          }}
        />
      )}

      <ImportDialog currency={currency} csv={csv} />
      <DocumentUploadDialog
        open={documentUploadOpen}
        onOpenChange={setActivityDocumentUploadOpen}
        onSpreadsheetFile={(file) => {
          csv.handleImportFile(file)
          csv.setImportOpen(true)
        }}
      />
      {viewingDocumentId != null && (
        <DocumentViewerDialog
          documentId={viewingDocumentId}
          onClose={() => setActivityViewingDocumentId(null)}
        />
      )}
    </Box>
  )
}
