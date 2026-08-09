import { useEffect, useRef, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  TextField,
  Select,
  Badge,
  IconButton,
  Dialog,
  Button,
  Card,
  Skeleton,
  AlertDialog,
  VisuallyHidden,
} from '@radix-ui/themes'
import { Search, Trash2, X, Calendar, FileText } from 'lucide-react'
import { format, isToday, isYesterday, parseISO, startOfWeek } from 'date-fns'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency, formatSignedAmount } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import {
  useTransactionFilters,
  DATE_PRESET_LABELS,
  type DatePreset,
} from '../../../shared/hooks/useTransactionFilters.ts'
import { useTransactionList } from '../../../shared/hooks/useTransactionList.ts'
import type { Transaction } from '../../../store/slices/transactionsSlice.ts'
import styles from './Activity.module.css'

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
    filtersActive,
    clearFilters,
    setSearch,
    setTypeFilter,
    setCategoryFilter,
    setMerchantFilter,
    setDatePreset,
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
  } = useTransactionList(filters)

  const {
    pending,
    fetchPendingDocuments,
    openScanReview,
    showFilters,
    swipedId,
    selectedId,
    editNotes,
    setShowFilters,
    setSwipedId,
    openDetail,
    closeDetail,
    setEditNotes,
  } = useBoundStore(
    useShallow((s) => ({
      // Select the stable array reference — filtering *inside* the selector returns a new
      // array every render and makes useShallow loop forever (Zustand pitfall).
      pending: s.documents.pending,
      fetchPendingDocuments: s.documents.fetchPendingDocuments,
      openScanReview: s.ui.openScanReview,
      showFilters: s.activityPage.mobileShowFilters,
      swipedId: s.activityPage.mobileSwipedId,
      selectedId: s.activityPage.mobileSelectedId,
      editNotes: s.activityPage.mobileEditNotes,
      setShowFilters: s.activityPage.setMobileActivityShowFilters,
      setSwipedId: s.activityPage.setMobileActivitySwipedId,
      openDetail: s.activityPage.openMobileActivityDetail,
      closeDetail: s.activityPage.closeMobileActivityDetail,
      setEditNotes: s.activityPage.setMobileActivityEditNotes,
    })),
  )
  // Only receipt-kind docs get the mobile review sheet; statements need the desktop
  // multi-row table (S4), so they're not surfaced here.
  const pendingReceipts = pending.filter((d) => d.kind !== 'statement')
  const selected = transactions.find((t) => t.id === selectedId) || null
  const touchStartX = useRef(0)

  useEffect(() => {
    fetchPendingDocuments()
  }, [fetchPendingDocuments])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX
  }
  const handleTouchEnd = (id: number, e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0]!.clientX
    if (diff > 60) setSwipedId(id)
    else if (diff < -30) setSwipedId(null)
  }

  const grouped: Record<DateGroup, Transaction[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }
  for (const t of transactions) grouped[getDateGroup(t.date)].push(t)

  return (
    <Box className={styles.page}>
      <Flex align="center" justify="between" mb="3">
        <Text size="5" weight="bold">
          Activity
        </Text>
        {/* Z5: `highContrast` promotes the label to accent-12. The default ghost accent
            measured 4.4:1 at this 12px size — marginally under the AA floor. */}
        <Button variant="ghost" size="1" highContrast onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? 'Hide filters' : 'Filters'}
        </Button>
      </Flex>

      <TextField.Root
        className={styles.searchInput}
        mb="2"
        placeholder="Search..."
        value={filters.search}
        onChange={(e) => setSearch(e.target.value)}
      >
        <TextField.Slot side="left">
          <Search size={16} />
        </TextField.Slot>
      </TextField.Root>

      {pendingReceipts.length > 0 && (
        <Flex direction="column" gap="2" mb="3">
          {pendingReceipts.map((doc) => (
            <Card
              key={doc.id}
              className={styles.pendingCard}
              onClick={() => openScanReview(doc.id)}
            >
              <Flex align="center" justify="between" gap="2">
                <Flex align="center" gap="2" className={styles.txContent}>
                  <FileText size={16} color="var(--gray-9)" />
                  <Box>
                    <Text as="div" size="2" weight="medium">
                      {doc.extracted_json?.merchant || 'Scanned receipt'}
                    </Text>
                    <Text as="div" size="1" color="gray">
                      {doc.extracted_json?.total != null
                        ? `${formatCurrency(doc.extracted_json.total, currency)} · tap to review`
                        : 'Tap to review'}
                    </Text>
                  </Box>
                </Flex>
                <Badge size="1">Pending</Badge>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}

      <Flex gap="2" mb="2" align="center" wrap="wrap">
        <Select.Root value={filters.typeFilter} onValueChange={setTypeFilter}>
          <Select.Trigger placeholder="All" className={styles.filterSelect} />
          <Select.Content>
            <Select.Item value="">All</Select.Item>
            <Select.Item value="income">Income</Select.Item>
            <Select.Item value="expense">Expense</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {showFilters && (
        <Flex gap="2" mb="3" direction="column">
          <Select.Root value={filters.categoryFilter} onValueChange={setCategoryFilter}>
            <Select.Trigger placeholder="All categories" />
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
            <Select.Trigger placeholder="All merchants" />
            <Select.Content>
              <Select.Item value="">All merchants</Select.Item>
              {merchants.map((m) => (
                <Select.Item key={m.id} value={String(m.id)}>
                  {m.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          {/* Named ranges instead of two raw date fields — the win is bigger here than on
              desktop, where a native date input on a phone means the OS spinner twice. */}
          <Select.Root
            value={filters.datePreset}
            onValueChange={(v) => setDatePreset(v as DatePreset)}
          >
            <Select.Trigger placeholder="All time" aria-label="Date range" />
            <Select.Content>
              {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => (
                <Select.Item key={p} value={p}>
                  {DATE_PRESET_LABELS[p]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          {filters.datePreset === 'custom' && (
            <Flex gap="2" align="center">
              <Calendar size={14} />
              <TextField.Root
                type="date"
                aria-label="Filter start date"
                value={filters.startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={styles.dateField}
              />
              <Text size="1" color="gray">
                to
              </Text>
              <TextField.Root
                type="date"
                aria-label="Filter end date"
                value={filters.endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={styles.dateField}
              />
            </Flex>
          )}
        </Flex>
      )}

      {loading && transactions.length === 0 ? (
        <Flex direction="column" gap="3" p="3">
          {['100%', '65%', '80%'].map((w) => (
            <Skeleton key={w}>
              <Text as="div" size="2" style={{ width: w }}>
                Placeholder transaction line
              </Text>
            </Skeleton>
          ))}
        </Flex>
      ) : transactions.length === 0 ? (
        <Flex direction="column" align="center" gap="2" py="6">
          <Text size="3" weight="medium">
            {filtersActive ? 'No matches' : 'No transactions'}
          </Text>
          <Text size="2" color="gray">
            {filtersActive ? 'Nothing matched these filters' : 'Add one using quick-add'}
          </Text>
          {filtersActive && (
            <Button variant="soft" size="2" mt="2" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </Flex>
      ) : (
        <Box>
          {(Object.entries(grouped) as [DateGroup, Transaction[]][]).map(([group, items]) =>
            items.length > 0 ? (
              <Box key={group} mb="3">
                <Text size="1" weight="bold" color="gray" mb="1" className={styles.groupHeader}>
                  {groupLabel[group]}
                </Text>
                {items.map((t) => (
                  <Flex
                    key={t.id}
                    className={`${styles.row} ${swipedId === t.id ? styles.swiped : ''}`}
                    align="center"
                    justify="between"
                    onClick={() => openDetail(t)}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(e) => handleTouchEnd(t.id, e)}
                  >
                    <Flex direction="column" gap="1" className={styles.txContent}>
                      <Text size="2" weight="medium" className={styles.description}>
                        {t.description}
                      </Text>
                      <Flex gap="2" align="center" wrap="wrap">
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
                      </Flex>
                    </Flex>
                    <Flex align="center" gap="2" className={styles.txActions}>
                      <Text
                        size="2"
                        weight="bold"
                        color={t.transaction_type === 'income' ? 'green' : 'red'}
                      >
                        {formatSignedAmount(t.amount, t.transaction_type, currency)}
                      </Text>
                      {swipedId === t.id && (
                        <AlertDialog.Root>
                          <AlertDialog.Trigger>
                            <IconButton
                              variant="solid"
                              size="2"
                              color="red"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </AlertDialog.Trigger>
                          <AlertDialog.Content
                            maxWidth="360px"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <AlertDialog.Title>Delete transaction?</AlertDialog.Title>
                            <AlertDialog.Description size="2">
                              This permanently deletes "{t.description}" (
                              {formatCurrency(t.amount, currency)}). This can't be undone.
                            </AlertDialog.Description>
                            <Flex gap="3" mt="4" justify="end">
                              <AlertDialog.Cancel>
                                <Button
                                  variant="soft"
                                  color="gray"
                                  onClick={() => setSwipedId(null)}
                                >
                                  Cancel
                                </Button>
                              </AlertDialog.Cancel>
                              <AlertDialog.Action>
                                <Button
                                  variant="solid"
                                  color="red"
                                  onClick={() => {
                                    deleteTransaction(t.id)
                                    setSwipedId(null)
                                  }}
                                >
                                  Delete
                                </Button>
                              </AlertDialog.Action>
                            </Flex>
                          </AlertDialog.Content>
                        </AlertDialog.Root>
                      )}
                    </Flex>
                  </Flex>
                ))}
              </Box>
            ) : null,
          )}
          {loadingMore && (
            <Flex justify="center" py="3">
              <Text color="gray" size="2">
                Loading more...
              </Text>
            </Flex>
          )}
          <Box ref={sentinelRef} style={{ height: 1 }} />
        </Box>
      )}

      <Dialog.Root open={!!selected} onOpenChange={(open) => !open && closeDetail()}>
        <Dialog.Content className={styles.dialogDetail}>
          {selected && (
            <>
              <Flex justify="between" align="center" mb="3">
                <Dialog.Title className={styles.dialogTitle}>{selected.description}</Dialog.Title>
                <VisuallyHidden>
                  <Dialog.Description>Details for this transaction</Dialog.Description>
                </VisuallyHidden>
                <IconButton variant="ghost" onClick={closeDetail}>
                  <X size={16} />
                </IconButton>
              </Flex>

              <Flex direction="column" gap="3">
                <Flex justify="between" align="center">
                  <Text
                    size="6"
                    weight="bold"
                    color={selected.transaction_type === 'income' ? 'green' : 'red'}
                  >
                    {formatSignedAmount(selected.amount, selected.transaction_type, currency)}
                  </Text>
                  <Badge color={selected.transaction_type === 'income' ? 'green' : 'red'}>
                    {selected.transaction_type}
                  </Badge>
                </Flex>

                <Flex direction="column" gap="1">
                  <Text size="2" color="gray">
                    Date
                  </Text>
                  <Text size="2">{format(parseISO(selected.date), 'MMM d, yyyy')}</Text>
                </Flex>

                {selected.merchant_name && (
                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Merchant
                    </Text>
                    <Text size="2">{selected.merchant_name}</Text>
                  </Flex>
                )}

                {selected.category_name && (
                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Category
                    </Text>
                    <Badge color={(selected.category_color as 'gray') || 'gray'}>
                      {selected.category_name}
                    </Badge>
                  </Flex>
                )}

                {selected.account_name && (
                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Account
                    </Text>
                    <Text size="2">{selected.account_name}</Text>
                  </Flex>
                )}

                {selected.is_pending && <Badge>Pending</Badge>}
                {selected.is_recurring && <Badge color="gray">Recurring</Badge>}

                <Flex direction="column" gap="1">
                  <Text size="2" color="gray">
                    Notes
                  </Text>
                  <TextField.Root
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes..."
                  />
                </Flex>

                <Flex gap="2">
                  <Button
                    variant="soft"
                    color="green"
                    className={styles.dialogButton}
                    onClick={() => {
                      updateNotes(selected.id, editNotes)
                    }}
                  >
                    Save notes
                  </Button>
                  <AlertDialog.Root>
                    <AlertDialog.Trigger>
                      <Button variant="soft" color="red" className={styles.dialogButton}>
                        <Trash2 size={14} /> Delete
                      </Button>
                    </AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="360px">
                      <AlertDialog.Title>Delete transaction?</AlertDialog.Title>
                      <AlertDialog.Description size="2">
                        This permanently deletes "{selected.description}" (
                        {formatCurrency(selected.amount, currency)}). This can't be undone.
                      </AlertDialog.Description>
                      <Flex gap="3" mt="4" justify="end">
                        <AlertDialog.Cancel>
                          <Button variant="soft" color="gray">
                            Cancel
                          </Button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action>
                          <Button
                            variant="solid"
                            color="red"
                            onClick={() => {
                              deleteTransaction(selected.id)
                              closeDetail()
                            }}
                          >
                            Delete
                          </Button>
                        </AlertDialog.Action>
                      </Flex>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                </Flex>
              </Flex>
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
