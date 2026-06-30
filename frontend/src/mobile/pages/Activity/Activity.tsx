import { useState, useEffect, useRef, type JSX } from 'react'
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
} from '@radix-ui/themes'
import { Search, Trash2, Pencil, X, Calendar } from 'lucide-react'
import { format, isToday, isYesterday, parseISO, startOfWeek } from 'date-fns'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Activity.module.css'

type Transaction = {
  id: number
  amount: number
  description: string
  transaction_type: string
  account_id: number
  account_name: string | null
  category_id: number | null
  category_name: string | null
  category_color: string | null
  merchant_id: number | null
  merchant_name: string | null
  bill_id: number | null
  goal_id: number | null
  is_pending: boolean
  is_recurring: boolean
  date: string
  notes: string | null
  ai_categorized: boolean
  created_at: string
}

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
  const {
    items: transactions,
    loading,
    loadingMore,
    hasMore,
    categories,
    merchants,
    fetchTransactions,
    fetchTxFilters,
    deleteTransaction: deleteTx,
    updateNotes: updateTxNotes,
  } = useBoundStore(
    useShallow((s) => ({
      items: s.transactions.items,
      loading: s.transactions.loading,
      loadingMore: s.transactions.loadingMore,
      hasMore: s.transactions.hasMore,
      categories: s.transactions.categories,
      merchants: s.transactions.merchants,
      fetchTransactions: s.fetchTransactions,
      fetchTxFilters: s.fetchTxFilters,
      deleteTransaction: s.deleteTransaction,
      updateNotes: s.updateNotes,
    })),
  )
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [swipedId, setSwipedId] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [merchantFilter, setMerchantFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)

  useEffect(() => {
    fetchTxFilters()
  }, [fetchTxFilters])

  useEffect(() => {
    fetchTransactions({
      reset: true,
      search,
      typeFilter,
      categoryFilter,
      merchantFilter,
      startDate,
      endDate,
    })
  }, [fetchTransactions, search, typeFilter, categoryFilter, merchantFilter, startDate, endDate])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          fetchTransactions({
            search,
            typeFilter,
            categoryFilter,
            merchantFilter,
            startDate,
            endDate,
          })
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [
    hasMore,
    loading,
    loadingMore,
    fetchTransactions,
    search,
    typeFilter,
    categoryFilter,
    merchantFilter,
    startDate,
    endDate,
  ])

  const handleDelete = async (id: number) => {
    deleteTx(id)
    setSwipedId(null)
  }

  const openDetail = (t: Transaction) => {
    setSelected(t)
    setEditNotes(t.notes || '')
    setDialogOpen(true)
  }

  const handleUpdateNotes = async () => {
    if (!selected) return
    updateTxNotes(selected.id, editNotes)
    toast.success('Notes updated')
  }

  const handleDeleteFromDetail = async () => {
    if (!selected) return
    deleteTx(selected.id)
    toast.success('Transaction deleted')
    setDialogOpen(false)
    setSelected(null)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX
  }
  const handleTouchEnd = (id: number, e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0]!.clientX
    if (diff > 60) {
      setSwipedId(id)
    } else if (diff < -30) {
      setSwipedId(null)
    }
  }

  const formatAmount = (t: Transaction) => {
    const sign = t.transaction_type === 'income' ? '+' : '-'
    const color = t.transaction_type === 'income' ? 'green' : 'red'
    return (
      <Text size="2" weight="bold" color={color}>
        {sign}${t.amount.toFixed(2)}
      </Text>
    )
  }

  const grouped: Record<DateGroup, Transaction[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }
  for (const t of transactions) {
    grouped[getDateGroup(t.date)].push(t)
  }

  return (
    <Box className={styles.page}>
      <Flex align="center" justify="between" mb="3">
        <Text size="5" weight="bold">
          Activity
        </Text>
        <Button variant="ghost" size="1" onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? 'Hide filters' : 'Filters'}
        </Button>
      </Flex>

      <TextField.Root
        className={styles.searchInput}
        mb="2"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      >
        <TextField.Slot side="left">
          <Search size={16} />
        </TextField.Slot>
      </TextField.Root>

      <Flex gap="2" mb="2" align="center" wrap="wrap">
        <Select.Root value={typeFilter} onValueChange={setTypeFilter}>
          <Select.Trigger placeholder="All" style={{ minWidth: 100 }} />
          <Select.Content>
            <Select.Item value="">All</Select.Item>
            <Select.Item value="income">Income</Select.Item>
            <Select.Item value="expense">Expense</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {showFilters && (
        <Flex gap="2" mb="3" direction="column">
          <Select.Root value={categoryFilter} onValueChange={setCategoryFilter}>
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

          <Select.Root value={merchantFilter} onValueChange={setMerchantFilter}>
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

          <Flex gap="2" align="center">
            <Calendar size={14} />
            <TextField.Root
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ flex: 1 }}
            />
            <Text size="1" color="gray">
              to
            </Text>
            <TextField.Root
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ flex: 1 }}
            />
          </Flex>
        </Flex>
      )}

      {loading && transactions.length === 0 ? (
        <Text color="gray">Loading...</Text>
      ) : transactions.length === 0 ? (
        <Flex direction="column" align="center" gap="2" py="6">
          <Text size="3" weight="medium">
            No transactions
          </Text>
          <Text size="2" color="gray">
            Add one using quick-add
          </Text>
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
                    <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
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
                          <Badge color={(t.category_color as any) || 'gray'} size="1">
                            {t.category_name}
                          </Badge>
                        )}
                        <Text size="1" color="gray">
                          {format(parseISO(t.date), 'MMM d')}
                        </Text>
                      </Flex>
                    </Flex>
                    <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
                      {formatAmount(t)}
                      {swipedId === t.id && (
                        <IconButton
                          variant="solid"
                          size="2"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(t.id)
                          }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
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
          <div ref={sentinelRef} style={{ height: 1 }} />
        </Box>
      )}

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Content style={{ maxWidth: 360 }}>
          {selected && (
            <>
              <Flex justify="between" align="center" mb="3">
                <Dialog.Title style={{ margin: 0, fontSize: 'var(--font-size-4)' }}>
                  {selected.description}
                </Dialog.Title>
                <IconButton variant="ghost" onClick={() => setDialogOpen(false)}>
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
                    {selected.transaction_type === 'income' ? '+' : '-'}$
                    {selected.amount.toFixed(2)}
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
                    <Badge color={(selected.category_color as any) || 'gray'}>
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

                {selected.is_pending && <Badge color="orange">Pending</Badge>}
                {selected.is_recurring && <Badge color="blue">Recurring</Badge>}

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
                    onClick={handleUpdateNotes}
                    style={{ flex: 1 }}
                  >
                    <Pencil size={14} /> Save
                  </Button>
                  <Button
                    variant="soft"
                    color="red"
                    onClick={handleDeleteFromDetail}
                    style={{ flex: 1 }}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </Flex>
              </Flex>
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
