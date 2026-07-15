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
import { Search, Trash2, Pencil, X, Calendar, Download } from 'lucide-react'
import { format, isToday, isYesterday, parseISO, startOfWeek } from 'date-fns'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import api from '../../../auth/api.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
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
    updateTransaction: updateTx,
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
      updateTransaction: s.updateTransaction,
    })),
  )
  const accounts = useBoundStore((s) => s.accounts.items)
  const fetchAccounts = useBoundStore((s) => s.fetchAccounts)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    amount: 0,
    description: '',
    transaction_type: 'expense',
    category_id: null as number | null,
    merchant_id: null as number | null,
    account_id: 0,
    date: '',
    is_pending: false,
    is_recurring: false,
    notes: '',
  })
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
    fetchAccounts()
  }, [fetchTxFilters, fetchAccounts])

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
    setEditForm({
      amount: t.amount,
      description: t.description,
      transaction_type: t.transaction_type,
      category_id: t.category_id,
      merchant_id: t.merchant_id,
      account_id: t.account_id,
      date: t.date,
      is_pending: t.is_pending,
      is_recurring: t.is_recurring,
      notes: t.notes || '',
    })
    setEditing(false)
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

  const handleSaveEdit = async () => {
    if (!selected) return
    await updateTx(selected.id, editForm)
    toast.success('Transaction updated')
    setSelected({ ...selected, ...editForm })
    setEditing(false)
  }

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {}
      if (startDate) params.date_from = startDate
      if (endDate) params.date_to = endDate
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
    return (
      <Text size="2" weight="bold" color={t.transaction_type === 'income' ? 'green' : 'red'}>
        {sign}
        {formatCurrency(t.amount)}
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
          <Button variant="outline" size="2" onClick={handleExport}>
            <Download size={14} />
            Export CSV
          </Button>
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
                  {editing ? 'Edit Transaction' : selected.description}
                </Dialog.Title>
                <IconButton variant="ghost" onClick={() => setDialogOpen(false)}>
                  <X size={16} />
                </IconButton>
              </Flex>

              {editing ? (
                <Flex direction="column" gap="3">
                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Description
                    </Text>
                    <TextField.Root
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    />
                  </Flex>

                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Amount
                    </Text>
                    <TextField.Root
                      type="number"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) =>
                        setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </Flex>

                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Type
                    </Text>
                    <Select.Root
                      value={editForm.transaction_type}
                      onValueChange={(v) => setEditForm({ ...editForm, transaction_type: v })}
                    >
                      <Select.Trigger />
                      <Select.Content>
                        <Select.Item value="expense">Expense</Select.Item>
                        <Select.Item value="income">Income</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Flex>

                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Date
                    </Text>
                    <TextField.Root
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    />
                  </Flex>

                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Category
                    </Text>
                    <Select.Root
                      value={editForm.category_id ? String(editForm.category_id) : ''}
                      onValueChange={(v) =>
                        setEditForm({ ...editForm, category_id: v ? Number(v) : null })
                      }
                    >
                      <Select.Trigger placeholder="None" />
                      <Select.Content>
                        <Select.Item value="">None</Select.Item>
                        {categories.map((c) => (
                          <Select.Item key={c.id} value={String(c.id)}>
                            {c.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </Flex>

                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Merchant
                    </Text>
                    <Select.Root
                      value={editForm.merchant_id ? String(editForm.merchant_id) : ''}
                      onValueChange={(v) =>
                        setEditForm({ ...editForm, merchant_id: v ? Number(v) : null })
                      }
                    >
                      <Select.Trigger placeholder="None" />
                      <Select.Content>
                        <Select.Item value="">None</Select.Item>
                        {merchants.map((m) => (
                          <Select.Item key={m.id} value={String(m.id)}>
                            {m.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </Flex>

                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Account
                    </Text>
                    <Select.Root
                      value={String(editForm.account_id)}
                      onValueChange={(v) => setEditForm({ ...editForm, account_id: Number(v) })}
                    >
                      <Select.Trigger />
                      <Select.Content>
                        {accounts.map((a) => (
                          <Select.Item key={a.id} value={String(a.id)}>
                            {a.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </Flex>

                  <Flex gap="3" align="center">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <input
                        type="checkbox"
                        checked={editForm.is_pending}
                        onChange={(e) => setEditForm({ ...editForm, is_pending: e.target.checked })}
                      />
                      <Text size="2">Pending</Text>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <input
                        type="checkbox"
                        checked={editForm.is_recurring}
                        onChange={(e) =>
                          setEditForm({ ...editForm, is_recurring: e.target.checked })
                        }
                      />
                      <Text size="2">Recurring</Text>
                    </label>
                  </Flex>

                  <Flex gap="2">
                    <Button
                      variant="soft"
                      color="gray"
                      onClick={() => setEditing(false)}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </Button>
                    <Button variant="solid" onClick={handleSaveEdit} style={{ flex: 1 }}>
                      Save
                    </Button>
                  </Flex>
                </Flex>
              ) : (
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="center">
                    <Text
                      size="6"
                      weight="bold"
                      color={selected.transaction_type === 'income' ? 'green' : 'red'}
                    >
                      {selected.transaction_type === 'income' ? '+' : '-'}
                      {formatCurrency(selected.amount)}
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
                    <Button variant="soft" onClick={() => setEditing(true)} style={{ flex: 1 }}>
                      <Pencil size={14} /> Edit
                    </Button>
                    <Button
                      variant="soft"
                      color="green"
                      onClick={handleUpdateNotes}
                      style={{ flex: 1 }}
                    >
                      Save notes
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
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
