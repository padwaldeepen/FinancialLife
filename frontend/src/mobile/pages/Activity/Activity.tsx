import { useState, useEffect, useRef, useCallback, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  Button,
  TextField,
  Select,
  Badge,
  IconButton,
  Dialog,
} from '@radix-ui/themes'
import { Search, Trash2, Pencil, X } from 'lucide-react'
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
  category_id: number | null
  category_name: string | null
  category_color: string | null
  merchant_id: number | null
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [swipedId, setSwipedId] = useState<number | null>(null)
  const offsetRef = useRef(0)
  const limit = 50
  const touchStartX = useRef(0)

  const fetchTransactions = useCallback(
    async (reset = false) => {
      setLoading(true)
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
        const response = await api.get('/api/transactions/', { params })
        const data = response.data as Transaction[]
        if (reset) {
          setTransactions(data)
        } else {
          setTransactions((prev) => [...prev, ...data])
        }
        offsetRef.current = offset + data.length
      } catch (error: any) {
        toast.error(error.response?.data?.detail || 'Failed to load transactions')
      } finally {
        setLoading(false)
      }
    },
    [search, typeFilter],
  )

  useEffect(() => {
    offsetRef.current = 0
    fetchTransactions(true)
  }, [fetchTransactions])

  const handleDelete = async (id: number) => {
    const tx = transactions.find((t) => t.id === id)
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    setSwipedId(null)
    try {
      await api.delete(`/api/transactions/${id}`)
      toast.success('Transaction deleted', { id: `del-${id}` })
    } catch (error: any) {
      if (tx) setTransactions((prev) => [...prev, tx])
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
      <Text size="5" weight="bold" mb="3">
        Activity
      </Text>

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

      <Flex gap="2" mb="3" align="center">
        <Select.Root value={typeFilter} onValueChange={setTypeFilter}>
          <Select.Trigger placeholder="All" style={{ minWidth: 100 }} />
          <Select.Content>
            <Select.Item value="">All</Select.Item>
            <Select.Item value="income">Income</Select.Item>
            <Select.Item value="expense">Expense</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

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
                      <Flex gap="2" align="center">
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
          {transactions.length >= limit && (
            <Flex justify="center" py="3">
              <Button onClick={() => fetchTransactions()} loading={loading} variant="soft" size="2">
                Load more
              </Button>
            </Flex>
          )}
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
