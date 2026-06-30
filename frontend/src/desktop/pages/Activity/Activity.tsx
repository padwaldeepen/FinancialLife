import { useState, useEffect, useRef, useCallback, type JSX } from 'react'
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
import api from '../../../auth/api.ts'
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

type FilterOption = { id: number; name: string }

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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [merchantFilter, setMerchantFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [categories, setCategories] = useState<FilterOption[]>([])
  const [merchants, setMerchants] = useState<FilterOption[]>([])
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const offsetRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const limit = 50

  const fetchOptions = useCallback(async () => {
    try {
      const [catRes, merRes] = await Promise.all([
        api.get('/api/categories/'),
        api.get('/api/merchants/'),
      ])
      setCategories((catRes.data as FilterOption[]) || [])
      setMerchants((merRes.data as FilterOption[]) || [])
    } catch {
      // options are non-critical
    }
  }, [])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  const fetchTransactions = useCallback(
    async (reset = false) => {
      if (reset) {
        setLoading(true)
        offsetRef.current = 0
        setHasMore(true)
      } else {
        setLoadingMore(true)
      }
      try {
        const offset = reset ? 0 : offsetRef.current
        const params: Record<string, string | number> = {
          skip: offset,
          limit,
          sort_by: 'date',
          sort_order: 'desc',
        }
        if (search) params.search = search
        if (typeFilter) params.transaction_type = typeFilter
        if (categoryFilter) params.category_id = Number(categoryFilter)
        if (merchantFilter) params.merchant_id = Number(merchantFilter)
        if (startDate) params.start_date = startDate
        if (endDate) params.end_date = endDate
        const response = await api.get('/api/transactions/', { params })
        const data = response.data as Transaction[]
        if (reset) {
          setTransactions(data)
        } else {
          setTransactions((prev) => [...prev, ...data])
        }
        offsetRef.current = offset + data.length
        if (data.length < limit) setHasMore(false)
      } catch (error: any) {
        toast.error(error.response?.data?.detail || 'Failed to load transactions')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [search, typeFilter, categoryFilter, merchantFilter, startDate, endDate],
  )

  useEffect(() => {
    offsetRef.current = 0
    setHasMore(true)
    fetchTransactions(true)
  }, [fetchTransactions])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          fetchTransactions()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, fetchTransactions])

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/transactions/${id}`)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      toast.success('Transaction deleted')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete')
    }
  }

  const openDetail = (t: Transaction) => {
    setSelected(t)
    setEditNotes(t.notes || '')
    setDialogOpen(true)
  }

  const handleUpdateNotes = async () => {
    if (!selected) return
    try {
      await api.put(`/api/transactions/${selected.id}`, { notes: editNotes })
      setTransactions((prev) =>
        prev.map((t) => (t.id === selected.id ? { ...t, notes: editNotes } : t)),
      )
      toast.success('Notes updated')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update')
    }
  }

  const handleDeleteFromDetail = async () => {
    if (!selected) return
    await handleDelete(selected.id)
    setDialogOpen(false)
    setSelected(null)
  }

  const formatAmount = (t: Transaction) => {
    const sign = t.transaction_type === 'income' ? '+' : '-'
    const color = t.transaction_type === 'income' ? 'green' : 'red'
    return (
      <Text size="3" weight="bold" color={color}>
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
      <Text size="6" weight="bold" mb="4">
        Activity
      </Text>

      <TextField.Root
        className={styles.searchInput}
        mb="3"
        placeholder="Search transactions..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      >
        <TextField.Slot side="left">
          <Search size={16} />
        </TextField.Slot>
      </TextField.Root>

      <Flex gap="2" mb="3" wrap="wrap" align="center">
        <Select.Root value={typeFilter} onValueChange={setTypeFilter}>
          <Select.Trigger placeholder="All types" />
          <Select.Content>
            <Select.Item value="">All types</Select.Item>
            <Select.Item value="income">Income</Select.Item>
            <Select.Item value="expense">Expense</Select.Item>
          </Select.Content>
        </Select.Root>

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

        <TextField.Root
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{ width: 140 }}
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
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{ width: 140 }}
        >
          <TextField.Slot side="left">
            <Calendar size={14} />
          </TextField.Slot>
        </TextField.Root>
      </Flex>

      {loading && transactions.length === 0 ? (
        <Text color="gray">Loading...</Text>
      ) : transactions.length === 0 ? (
        <Flex direction="column" align="center" gap="2" py="8">
          <Text size="4" weight="medium">
            No transactions yet
          </Text>
          <Text size="2" color="gray">
            Add one using the quick-add feature
          </Text>
        </Flex>
      ) : (
        <Box>
          {(Object.entries(grouped) as [DateGroup, Transaction[]][]).map(([group, items]) =>
            items.length > 0 ? (
              <Box key={group} mb="4">
                <Text size="2" weight="bold" color="gray" mb="2" className={styles.groupHeader}>
                  {groupLabel[group]}
                </Text>
                {items.map((t) => (
                  <Flex
                    key={t.id}
                    className={styles.row}
                    align="center"
                    justify="between"
                    onClick={() => openDetail(t)}
                  >
                    <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                      <Text size="2" weight="medium">
                        {t.description}
                      </Text>
                      <Flex gap="2" align="center" wrap="wrap">
                        {t.merchant_name && (
                          <Text size="1" color="gray">
                            {t.merchant_name}
                          </Text>
                        )}
                        {t.category_name && (
                          <Badge color={(t.category_color as any) || 'gray'}>
                            {t.category_name}
                          </Badge>
                        )}
                        <Text size="1" color="gray">
                          {format(parseISO(t.date), 'MMM d, yyyy')}
                        </Text>
                      </Flex>
                    </Flex>
                    <Flex align="center" gap="3" style={{ flexShrink: 0 }}>
                      {formatAmount(t)}
                      <IconButton
                        variant="ghost"
                        size="1"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(t.id)
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </Flex>
                  </Flex>
                ))}
              </Box>
            ) : null,
          )}
          {loadingMore && (
            <Flex justify="center" py="4">
              <Text color="gray" size="2">
                Loading more...
              </Text>
            </Flex>
          )}
          <div ref={sentinelRef} style={{ height: 1 }} />
        </Box>
      )}

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Content style={{ maxWidth: 480 }}>
          {selected && (
            <>
              <Flex justify="between" align="center" mb="3">
                <Dialog.Title style={{ margin: 0 }}>{selected.description}</Dialog.Title>
                <IconButton variant="ghost" onClick={() => setDialogOpen(false)}>
                  <X size={16} />
                </IconButton>
              </Flex>

              <Flex direction="column" gap="3">
                <Flex justify="between" align="center">
                  <Text
                    size="5"
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
                  <Text size="2">{format(parseISO(selected.date), 'EEEE, MMMM d, yyyy')}</Text>
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

                <Flex gap="2" justify="end">
                  <Button variant="soft" color="green" onClick={handleUpdateNotes}>
                    <Pencil size={14} /> Save notes
                  </Button>
                  <Button variant="soft" color="red" onClick={handleDeleteFromDetail}>
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
