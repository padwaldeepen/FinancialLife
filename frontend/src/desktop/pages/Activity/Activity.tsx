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
  Checkbox,
} from '@radix-ui/themes'
import { Search, Trash2, Pencil, X, Calendar, Download, Link2, Unlink } from 'lucide-react'
import { format, isToday, isYesterday, parseISO, startOfWeek } from 'date-fns'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import api from '../../../auth/api.ts'
import { formatCurrency, getAmountColor } from '../../../shared/utils/format.ts'
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
  const bills = useBoundStore((s) => s.bills.items)
  const fetchBills = useBoundStore((s) => s.fetchBills)
  const linkTransactionToBill = useBoundStore((s) => s.linkTransactionToBill)
  const unlinkTransactionFromBill = useBoundStore((s) => s.unlinkTransactionFromBill)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [merchantFilter, setMerchantFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
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
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [linkBillOpen, setLinkBillOpen] = useState(false)
  const [linkBillSearch, setLinkBillSearch] = useState('')

  useEffect(() => {
    fetchTxFilters()
    fetchAccounts()
    fetchBills()
  }, [fetchTxFilters, fetchAccounts, fetchBills])

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
    toast.success('Transaction deleted', { id: `del-${id}` })
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

  const handleLinkToBill = async (billId: number) => {
    if (!selected) return
    try {
      await linkTransactionToBill(billId, selected.id)
      toast.success('Linked to bill')
      setSelected({ ...selected, bill_id: billId })
      setLinkBillOpen(false)
    } catch {
      toast.error('Failed to link')
    }
  }

  const handleUnlinkBill = async () => {
    if (!selected || !selected.bill_id) return
    try {
      await unlinkTransactionFromBill(selected.bill_id, selected.id)
      toast.success('Unlinked from bill')
      setSelected({ ...selected, bill_id: null })
    } catch {
      toast.error('Failed to unlink')
    }
  }

  const linkedBill = selected?.bill_id ? bills.find((b: any) => b.id === selected.bill_id) : null
  const availableBills = (bills as any[]).filter((b: any) =>
    b.name.toLowerCase().includes(linkBillSearch.toLowerCase()),
  )

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

  const formatAmount = (t: Transaction) => {
    const sign = t.transaction_type === 'income' ? '+' : '-'
    return (
      <span className={styles.txAmount} style={{ color: getAmountColor(t.transaction_type) }}>
        {sign}
        {formatCurrency(t.amount)}
      </span>
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
      <Flex className={styles.pageHeader} direction="column">
        <span className={styles.pageTitle}>Activity</span>
        <span className={styles.pageSubtitle}>
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </span>
      </Flex>

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

      <Flex className={styles.filterBar} mb="4" wrap="wrap">
        <Select.Root value={typeFilter} onValueChange={setTypeFilter}>
          <Select.Trigger className={styles.filterBarSelect} placeholder="All types" />
          <Select.Content>
            <Select.Item value="">All types</Select.Item>
            <Select.Item value="income">Income</Select.Item>
            <Select.Item value="expense">Expense</Select.Item>
          </Select.Content>
        </Select.Root>

        <Select.Root value={categoryFilter} onValueChange={setCategoryFilter}>
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

        <Select.Root value={merchantFilter} onValueChange={setMerchantFilter}>
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

        <Button variant="outline" size="2" onClick={handleExport}>
          <Download size={14} />
          Export CSV
        </Button>
      </Flex>

      {loading && transactions.length === 0 ? (
        <Flex className={styles.emptyState}>
          <Text color="gray">Loading...</Text>
        </Flex>
      ) : transactions.length === 0 ? (
        <Flex className={styles.emptyState} direction="column">
          <span className={styles.emptyTitle}>No transactions yet</span>
          <span className={styles.emptyHint}>Add one using the quick-add feature</span>
        </Flex>
      ) : (
        <Box>
          {(Object.entries(grouped) as [DateGroup, Transaction[]][]).map(([group, items]) =>
            items.length > 0 ? (
              <Box key={group} mb="4">
                <div className={styles.groupHeader}>{groupLabel[group]}</div>
                {items.map((t) => (
                  <Flex
                    key={t.id}
                    className={styles.row}
                    align="center"
                    justify="between"
                    onClick={() => openDetail(t)}
                  >
                    <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                      <div className={styles.txDescription}>{t.description}</div>
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
            <div className={styles.loadingMore}>
              <Text color="gray" size="2">
                Loading more...
              </Text>
            </div>
          )}
          <div ref={sentinelRef} style={{ height: 1 }} />
        </Box>
      )}

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Content style={{ maxWidth: 480 }}>
          {selected && (
            <>
              <Flex justify="between" align="center" className={styles.detailHeader}>
                <Dialog.Title style={{ margin: 0 }}>
                  {editing ? 'Edit Transaction' : selected.description}
                </Dialog.Title>
                <IconButton variant="ghost" onClick={() => setDialogOpen(false)}>
                  <X size={16} />
                </IconButton>
              </Flex>

              {editing ? (
                <Flex direction="column" gap="3">
                  <Flex direction="column" gap="1">
                    <span className={styles.detailLabel}>Description</span>
                    <TextField.Root
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    />
                  </Flex>

                  <Flex direction="column" gap="1">
                    <span className={styles.detailLabel}>Amount</span>
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
                    <span className={styles.detailLabel}>Type</span>
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
                    <span className={styles.detailLabel}>Date</span>
                    <TextField.Root
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    />
                  </Flex>

                  <Flex direction="column" gap="1">
                    <span className={styles.detailLabel}>Category</span>
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
                    <span className={styles.detailLabel}>Merchant</span>
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
                    <span className={styles.detailLabel}>Account</span>
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

                  <Flex gap="4" align="center">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Checkbox
                        checked={editForm.is_pending}
                        onCheckedChange={(v) =>
                          setEditForm({ ...editForm, is_pending: v === true })
                        }
                      />
                      <Text size="2">Pending</Text>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Checkbox
                        checked={editForm.is_recurring}
                        onCheckedChange={(v) =>
                          setEditForm({ ...editForm, is_recurring: v === true })
                        }
                      />
                      <Text size="2">Recurring</Text>
                    </label>
                  </Flex>

                  <Flex gap="2" justify="end">
                    <Button variant="soft" color="gray" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button variant="solid" onClick={handleSaveEdit}>
                      Save changes
                    </Button>
                  </Flex>
                </Flex>
              ) : (
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="center">
                    <span
                      className={styles.detailAmount}
                      style={{
                        color: getAmountColor(selected.transaction_type),
                      }}
                    >
                      {selected.transaction_type === 'income' ? '+' : '-'}
                      {formatCurrency(selected.amount)}
                    </span>
                    <Badge color={selected.transaction_type === 'income' ? 'green' : 'red'}>
                      {selected.transaction_type}
                    </Badge>
                  </Flex>

                  <div className={styles.detailSection}>
                    <div className={styles.detailLabel}>Date</div>
                    <div className={styles.detailValue}>
                      {format(parseISO(selected.date), 'EEEE, MMMM d, yyyy')}
                    </div>
                  </div>

                  {selected.merchant_name && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailLabel}>Merchant</div>
                      <div className={styles.detailValue}>{selected.merchant_name}</div>
                    </div>
                  )}

                  {selected.category_name && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailLabel}>Category</div>
                      <Badge color={(selected.category_color as 'gray') || 'gray'}>
                        {selected.category_name}
                      </Badge>
                    </div>
                  )}

                  {selected.account_name && (
                    <div className={styles.detailSection}>
                      <div className={styles.detailLabel}>Account</div>
                      <div className={styles.detailValue}>{selected.account_name}</div>
                    </div>
                  )}

                  <div className={styles.detailSection}>
                    <div className={styles.detailLabel}>Bill</div>
                    {linkedBill ? (
                      <Flex align="center" gap="2">
                        <div className={styles.detailValue}>{linkedBill.name}</div>
                        <Button size="1" variant="ghost" color="red" onClick={handleUnlinkBill}>
                          <Unlink size={12} />
                        </Button>
                      </Flex>
                    ) : (
                      <Button size="1" variant="soft" onClick={() => setLinkBillOpen(true)}>
                        <Link2 size={12} /> Link to bill
                      </Button>
                    )}
                  </div>

                  <Flex gap="2">
                    {selected.is_pending && (
                      <Badge color="orange" variant="soft">
                        Pending
                      </Badge>
                    )}
                    {selected.is_recurring && (
                      <Badge color="blue" variant="soft">
                        Recurring
                      </Badge>
                    )}
                  </Flex>

                  <Flex direction="column" gap="1">
                    <span className={styles.detailLabel}>Notes</span>
                    <TextField.Root
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Add notes..."
                    />
                  </Flex>

                  <Flex gap="2" justify="end">
                    <Button variant="soft" onClick={() => setEditing(true)}>
                      <Pencil size={14} /> Edit
                    </Button>
                    <Button variant="soft" color="green" onClick={handleUpdateNotes}>
                      Save notes
                    </Button>
                    <Button variant="soft" color="red" onClick={handleDeleteFromDetail}>
                      <Trash2 size={14} /> Delete
                    </Button>
                  </Flex>
                </Flex>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={linkBillOpen} onOpenChange={setLinkBillOpen}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>Link to Bill</Dialog.Title>
          <TextField.Root
            placeholder="Search bills..."
            value={linkBillSearch}
            onChange={(e) => setLinkBillSearch(e.target.value)}
            mt="3"
            mb="3"
          >
            <TextField.Slot side="left">
              <Search size={14} />
            </TextField.Slot>
          </TextField.Root>
          <Flex direction="column" gap="1" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {availableBills.length === 0 ? (
              <Text size="2" color="gray">
                No bills found
              </Text>
            ) : (
              availableBills.map((bill: any) => (
                <Flex
                  key={bill.id}
                  align="center"
                  justify="between"
                  className={styles.row}
                  onClick={() => handleLinkToBill(bill.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <Text size="2" weight="medium">
                    {bill.name}
                  </Text>
                  <Text size="2" color="gray">
                    {formatCurrency(bill.amount)}
                  </Text>
                </Flex>
              ))
            )}
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
