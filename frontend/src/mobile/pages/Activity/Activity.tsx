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
import { Search, Trash2, Pencil, X, Calendar, Download, Link2, Unlink, Upload } from 'lucide-react'
import Papa from 'papaparse'
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
  const bills = useBoundStore((s) => s.bills.items)
  const fetchBills = useBoundStore((s) => s.fetchBills)
  const linkTransactionToBill = useBoundStore((s) => s.linkTransactionToBill)
  const unlinkTransactionFromBill = useBoundStore((s) => s.unlinkTransactionFromBill)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editing, setEditing] = useState(false)
  const [linkBillOpen, setLinkBillOpen] = useState(false)
  const [linkBillSearch, setLinkBillSearch] = useState('')
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
  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState<'upload' | 'map' | 'preview'>('upload')
  const [importCsvHeaders, setImportCsvHeaders] = useState<string[]>([])
  const [importCsvRows, setImportCsvRows] = useState<Record<string, string>[]>([])
  const [importMapping, setImportMapping] = useState<Record<string, string>>({
    date: '',
    description: '',
    amount: '',
    type: '',
    category: '',
    merchant: '',
    account: '',
    notes: '',
  })
  const [importing, setImporting] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

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

  const linkedBill = selected?.bill_id
    ? (bills as any[]).find((b: any) => b.id === selected.bill_id)
    : null
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

  const autoDetectMapping = useCallback((headers: string[]) => {
    const lower = headers.map((h) => h.toLowerCase().trim())
    const mapping: Record<string, string> = {
      date: '',
      description: '',
      amount: '',
      type: '',
      category: '',
      merchant: '',
      account: '',
      notes: '',
    }
    const patterns: Record<string, string[]> = {
      date: ['date', 'trans date', 'transaction date', 'posted date'],
      description: ['description', 'desc', 'payee', 'memo', 'name', 'narrative'],
      amount: ['amount', 'debit', 'credit', 'value', 'sum'],
      type: ['type', 'transaction type', 'debit/credit'],
      category: ['category', 'cat', 'group'],
      merchant: ['merchant', 'payee', 'vendor'],
      account: ['account', 'account name', 'acct'],
      notes: ['notes', 'note', 'memo', 'comment'],
    }
    for (const [field, keywords] of Object.entries(patterns)) {
      for (const kw of keywords) {
        const idx = lower.findIndex((h) => h === kw || h.includes(kw))
        if (idx !== -1) {
          mapping[field] = headers[idx] || ''
          break
        }
      }
    }
    return mapping
  }, [])

  const handleImportFile = useCallback(
    (file: File) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            toast.error('CSV parse error: ' + (results.errors[0]?.message || 'Unknown error'))
            return
          }
          const data = results.data as Record<string, string>[]
          if (data.length === 0) {
            toast.error('CSV is empty')
            return
          }
          const headers = results.meta.fields || (data[0] ? Object.keys(data[0]) : [])
          setImportCsvHeaders(headers)
          setImportCsvRows(data)
          setImportMapping(autoDetectMapping(headers))
          setImportStep('map')
        },
      })
    },
    [autoDetectMapping],
  )

  const handleImportConfirm = async () => {
    if (!importMapping.date || !importMapping.description || !importMapping.amount) {
      toast.error('Date, Description, and Amount columns are required')
      return
    }
    const defaultAccount = accounts[0]
    if (!defaultAccount) {
      toast.error('No accounts found — create one first')
      return
    }
    setImporting(true)
    try {
      const transactions = importCsvRows.map((row) => {
        const amtCol = importMapping.amount || ''
        const typeCol = importMapping.type || ''
        const dateCol = importMapping.date || ''
        const descCol = importMapping.description || ''
        const notesCol = importMapping.notes || ''
        const rawAmount = parseFloat((row[amtCol] || '0').replace(/[^0-9.-]/g, ''))
        const rawType = (row[typeCol] || '').toLowerCase()
        let txType = 'expense'
        if (rawType.includes('income') || rawType.includes('credit')) {
          txType = 'income'
        } else if (!rawType.includes('expense') && !rawType.includes('debit')) {
          txType = rawAmount < 0 ? 'expense' : 'income'
        }
        const amount = Math.abs(rawAmount)
        const dateStr = row[dateCol] || ''
        const parsed = new Date(dateStr)
        const date = isNaN(parsed.getTime()) ? new Date() : parsed
        return {
          amount,
          description: row[descCol] || 'Imported transaction',
          transaction_type: txType,
          account_id: defaultAccount.id,
          date: date.toISOString(),
          notes: notesCol ? row[notesCol] || null : null,
        }
      })
      const res = await api.post('/api/transactions/import', { transactions })
      toast.success(`Imported ${res.data.imported} transactions`)
      if (res.data.errors?.length > 0) {
        toast.error(`${res.data.errors.length} rows failed`)
      }
      setImportOpen(false)
      resetImport()
      fetchTransactions({
        reset: true,
        search,
        typeFilter,
        categoryFilter,
        merchantFilter,
        startDate,
        endDate,
      })
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  const resetImport = () => {
    setImportStep('upload')
    setImportCsvHeaders([])
    setImportCsvRows([])
    setImportMapping({
      date: '',
      description: '',
      amount: '',
      type: '',
      category: '',
      merchant: '',
      account: '',
      notes: '',
    })
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
              className={styles.dateField}
            />
            <Text size="1" color="gray">
              to
            </Text>
            <TextField.Root
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={styles.dateField}
            />
          </Flex>
          <Button variant="outline" size="2" onClick={handleExport}>
            <Download size={14} />
            Export CSV
          </Button>
          <Button variant="outline" size="2" onClick={() => setImportOpen(true)}>
            <Upload size={14} />
            Import CSV
          </Button>
        </Flex>
      )}

      {loading && transactions.length === 0 ? (
        <Flex direction="column" gap="3" p="3">
          <div
            className="skeleton"
            style={{ height: 16, width: '100%', borderRadius: 'var(--radius-2)' }}
          />
          <div
            className="skeleton"
            style={{ height: 16, width: '65%', borderRadius: 'var(--radius-2)' }}
          />
          <div
            className="skeleton"
            style={{ height: 16, width: '80%', borderRadius: 'var(--radius-2)' }}
          />
          <div
            className="skeleton"
            style={{ height: 16, width: '45%', borderRadius: 'var(--radius-2)' }}
          />
        </Flex>
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
                          <Badge color={(t.category_color as any) || 'gray'} size="1">
                            {t.category_name}
                          </Badge>
                        )}
                        <Text size="1" color="gray">
                          {format(parseISO(t.date), 'MMM d')}
                        </Text>
                      </Flex>
                    </Flex>
                    <Flex align="center" gap="2" className={styles.txActions}>
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
        <Dialog.Content className={styles.dialogDetail}>
          {selected && (
            <>
              <Flex justify="between" align="center" mb="3">
                <Dialog.Title className={styles.dialogTitle}>
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
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={editForm.is_pending}
                        onChange={(e) => setEditForm({ ...editForm, is_pending: e.target.checked })}
                      />
                      <Text size="2">Pending</Text>
                    </label>
                    <label className={styles.checkboxLabel}>
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
                      className={styles.dialogButton}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="solid"
                      onClick={handleSaveEdit}
                      className={styles.dialogButton}
                    >
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

                  <Flex direction="column" gap="1">
                    <Text size="2" color="gray">
                      Bill
                    </Text>
                    {linkedBill ? (
                      <Flex align="center" gap="2">
                        <Text size="2">{linkedBill.name}</Text>
                        <Button size="1" variant="ghost" color="red" onClick={handleUnlinkBill}>
                          <Unlink size={12} />
                        </Button>
                      </Flex>
                    ) : (
                      <Button size="1" variant="soft" onClick={() => setLinkBillOpen(true)}>
                        <Link2 size={12} /> Link to bill
                      </Button>
                    )}
                  </Flex>

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
                      onClick={() => setEditing(true)}
                      className={styles.dialogButton}
                    >
                      <Pencil size={14} /> Edit
                    </Button>
                    <Button
                      variant="soft"
                      color="green"
                      onClick={handleUpdateNotes}
                      className={styles.dialogButton}
                    >
                      Save notes
                    </Button>
                    <Button
                      variant="soft"
                      color="red"
                      onClick={handleDeleteFromDetail}
                      className={styles.dialogButton}
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

      <Dialog.Root open={linkBillOpen} onOpenChange={setLinkBillOpen}>
        <Dialog.Content maxWidth="380px">
          <Dialog.Title>Link to Bill</Dialog.Title>
          <TextField.Root
            placeholder="Search bills..."
            value={linkBillSearch}
            onChange={(e) => setLinkBillSearch(e.target.value)}
            mt="3"
            mb="3"
          />
          <Flex direction="column" gap="1" className={styles.scrollableList}>
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
                  className={styles.billItem}
                  onClick={() => handleLinkToBill(bill.id)}
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

      <Dialog.Root
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open)
          if (!open) resetImport()
        }}
      >
        <Dialog.Content maxWidth="380px">
          <Dialog.Title>Import CSV</Dialog.Title>
          {importStep === 'upload' && (
            <Flex direction="column" gap="4" py="4" align="center">
              <Text size="2" color="gray">
                Upload a CSV file with your transactions
              </Text>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImportFile(file)
                }}
              />
              <Button variant="soft" onClick={() => importFileRef.current?.click()}>
                <Upload size={14} /> Choose CSV file
              </Button>
            </Flex>
          )}

          {importStep === 'map' && (
            <Flex direction="column" gap="3" py="3">
              <Text size="2" color="gray">
                Map CSV columns (* required)
              </Text>
              {(
                [
                  'date',
                  'description',
                  'amount',
                  'type',
                  'category',
                  'merchant',
                  'account',
                  'notes',
                ] as const
              ).map((field) => (
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
              <Flex direction="column" gap="1" className={styles.scrollableList}>
                {importCsvRows.slice(0, 10).map((row, i) => {
                  const amtCol = importMapping.amount || ''
                  const typeCol = importMapping.type || ''
                  const dateCol = importMapping.date || ''
                  const descCol = importMapping.description || ''
                  const rawAmount = parseFloat((row[amtCol] || '0').replace(/[^0-9.-]/g, ''))
                  const rawType = (row[typeCol] || '').toLowerCase()
                  const txType = rawType.includes('income')
                    ? 'income'
                    : rawAmount < 0
                      ? 'expense'
                      : 'income'
                  return (
                    <Flex
                      key={i}
                      align="center"
                      justify="between"
                      py="1"
                      className={styles.previewRow}
                    >
                      <Flex direction="column" gap="1">
                        <Text size="2">{row[descCol]}</Text>
                        <Text size="1" color="gray">
                          {row[dateCol]}
                        </Text>
                      </Flex>
                      <Flex align="center" gap="2">
                        <Text size="2" weight="bold">
                          {formatCurrency(Math.abs(rawAmount))}
                        </Text>
                        <Badge color={txType === 'income' ? 'green' : 'red'}>{txType}</Badge>
                      </Flex>
                    </Flex>
                  )
                })}
              </Flex>
              <Flex gap="2" justify="end" mt="2">
                <Button variant="soft" onClick={() => setImportStep('map')}>
                  Back
                </Button>
                <Button onClick={handleImportConfirm} disabled={importing}>
                  {importing ? 'Importing...' : `Import ${importCsvRows.length}`}
                </Button>
              </Flex>
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
