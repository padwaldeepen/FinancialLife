import { useState, useEffect, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  Button,
  Card,
  Dialog,
  TextField,
  Select,
  IconButton,
  Checkbox,
} from '@radix-ui/themes'
import { Plus, Trash2, Eye, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { BillDetail } from './BillDetail/BillDetail.tsx'
import styles from './Bills.module.css'

export const Bills = (): JSX.Element => {
  const {
    bills,
    upcoming,
    loading,
    fetchBills,
    fetchUpcomingBills,
    createBill,
    updateBill,
    deleteBill,
  } = useBoundStore(
    useShallow((s) => ({
      bills: s.bills.items as any[],
      upcoming: s.bills.upcoming as any[],
      loading: s.bills.loading,
      fetchBills: s.fetchBills,
      fetchUpcomingBills: s.fetchUpcomingBills,
      createBill: s.createBill,
      updateBill: s.updateBill,
      deleteBill: s.deleteBill,
    })),
  )
  const accounts = useBoundStore((s) => s.accounts.items) as any[]
  const fetchAccounts = useBoundStore((s) => s.fetchAccounts)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [dueDay, setDueDay] = useState('1')
  const [accountId, setAccountId] = useState('')
  const [isVariable, setIsVariable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedBill, setSelectedBill] = useState<any | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBillAmount, setEditBillAmount] = useState('')
  const [editFrequency, setEditFrequency] = useState('monthly')
  const [editDueDay, setEditDueDay] = useState('1')
  const [editAccountId, setEditAccountId] = useState('')
  const [editIsVariable, setEditIsVariable] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    fetchBills()
    fetchUpcomingBills()
    fetchAccounts()
  }, [fetchBills, fetchUpcomingBills, fetchAccounts])

  const handleCreate = async () => {
    if (!name.trim() || !billAmount || !accountId || !dueDay) return
    setSaving(true)
    try {
      await createBill({
        name: name.trim(),
        amount: parseFloat(billAmount),
        frequency,
        due_day: parseInt(dueDay, 10),
        account_id: parseInt(accountId, 10),
        is_variable: isVariable,
      })
      toast.success('Bill created')
      await fetchUpcomingBills()
      setOpen(false)
      setName('')
      setBillAmount('')
      setFrequency('monthly')
      setDueDay('1')
      setAccountId('')
      setIsVariable(false)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create bill')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteBill(id)
      await fetchUpcomingBills()
      toast.success('Bill deleted')
    } catch {
      toast.error('Failed to delete bill')
    }
  }

  const openEdit = () => {
    if (!selectedBill) return
    setEditName(selectedBill.name)
    setEditBillAmount(String(selectedBill.amount))
    setEditFrequency(selectedBill.frequency)
    setEditDueDay(String(selectedBill.due_day))
    setEditAccountId(String(selectedBill.account_id))
    setEditIsVariable(selectedBill.is_variable)
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedBill || !editName.trim() || !editBillAmount || !editAccountId || !editDueDay)
      return
    setSavingEdit(true)
    try {
      await updateBill(selectedBill.id, {
        name: editName.trim(),
        amount: parseFloat(editBillAmount),
        frequency: editFrequency,
        due_day: parseInt(editDueDay, 10),
        account_id: parseInt(editAccountId, 10),
        is_variable: editIsVariable,
      })
      toast.success('Bill updated')
      await fetchUpcomingBills()
      setEditOpen(false)
      setSelectedBill(null)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update bill')
    } finally {
      setSavingEdit(false)
    }
  }

  const frequencyLabel = (f: string) => {
    switch (f) {
      case 'weekly':
        return 'Weekly'
      case 'biweekly':
        return 'Biweekly'
      case 'monthly':
        return 'Monthly'
      case 'quarterly':
        return 'Quarterly'
      case 'yearly':
        return 'Yearly'
      default:
        return f
    }
  }

  return (
    <Box className={styles.page}>
      <Flex className={styles.pageHeader}>
        <span className={styles.pageTitle}>Bills</span>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger>
            <Button size="2">
              <Plus size={16} /> Add Bill
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="400px">
            <Dialog.Title>Create Bill</Dialog.Title>
            <Flex direction="column" gap="3" mt="3">
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Name
                </Text>
                <TextField.Root
                  placeholder="e.g. Rent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Flex>
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Amount
                </Text>
                <TextField.Root
                  type="number"
                  placeholder="1200"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                >
                  <TextField.Slot side="left">$</TextField.Slot>
                </TextField.Root>
              </Flex>
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Account
                </Text>
                <Select.Root value={accountId} onValueChange={setAccountId}>
                  <Select.Trigger placeholder="Select account" />
                  <Select.Content>
                    {accounts.map((a) => (
                      <Select.Item key={a.id} value={String(a.id)}>
                        {a.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>
              <Flex gap="3">
                <Box className={styles.flex1}>
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">
                      Frequency
                    </Text>
                    <Select.Root value={frequency} onValueChange={setFrequency}>
                      <Select.Trigger />
                      <Select.Content>
                        <Select.Item value="weekly">Weekly</Select.Item>
                        <Select.Item value="biweekly">Biweekly</Select.Item>
                        <Select.Item value="monthly">Monthly</Select.Item>
                        <Select.Item value="quarterly">Quarterly</Select.Item>
                        <Select.Item value="yearly">Yearly</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Flex>
                </Box>
                <Box className={styles.colWidth100}>
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">
                      Due Day
                    </Text>
                    <TextField.Root
                      type="number"
                      min={1}
                      max={31}
                      placeholder="1"
                      value={dueDay}
                      onChange={(e) => setDueDay(e.target.value)}
                    />
                  </Flex>
                </Box>
              </Flex>
              <Text as="label" size="2">
                <Flex align="center" gap="2">
                  <Checkbox
                    checked={isVariable}
                    onCheckedChange={(v) => setIsVariable(v === true)}
                  />
                  <Text>Variable amount (estimated)</Text>
                </Flex>
              </Text>
              <Button onClick={handleCreate} loading={saving} size="3" mt="2">
                Create Bill
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>

      {loading ? (
        <Flex direction="column" gap="3" p="4">
          <div
            className="skeleton"
            style={{ height: 20, width: '100%', borderRadius: 'var(--radius-2)' }}
          />
          <div
            className="skeleton"
            style={{ height: 20, width: '80%', borderRadius: 'var(--radius-2)' }}
          />
          <div
            className="skeleton"
            style={{ height: 20, width: '60%', borderRadius: 'var(--radius-2)' }}
          />
        </Flex>
      ) : bills.length === 0 ? (
        <Flex className={styles.emptyState} direction="column">
          <span className={styles.emptyTitle}>No bills yet</span>
          <span className={styles.emptyHint}>Add your recurring expenses to track them</span>
        </Flex>
      ) : (
        <>
          {bills.length > 0 && upcoming.length > 0 && (
            <Card mb="4" className={styles.upcomingCard}>
              <div className={styles.sectionTitle}>Upcoming (next 30 days)</div>
              <Flex direction="column" gap="2">
                {upcoming.map((bill: any) => (
                  <Flex key={bill.id} align="center" justify="between" className={styles.billRow}>
                    <Flex direction="column" gap="1" className={styles.flex1Min0}>
                      <Text size="2" weight="medium">
                        {bill.name}
                      </Text>
                      <Text size="1" color="gray">
                        {bill.days_until === 0
                          ? 'Due today'
                          : `In ${bill.days_until} day${bill.days_until === 1 ? '' : 's'}`}
                        {bill.is_variable && ' (estimated)'}
                      </Text>
                    </Flex>
                    <Text size="2" weight="bold">
                      {formatCurrency(bill.amount)}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Card>
          )}

          <div className={styles.sectionTitle}>All Bills</div>
          <Flex direction="column" gap="3">
            {bills.map((bill: any) => (
              <Card
                key={bill.id}
                size="2"
                className={styles.billCard}
                onClick={() => setSelectedBill(bill)}
              >
                <Flex align="center" justify="between">
                  <Flex direction="column" gap="1" className={styles.flex1Min0}>
                    <Flex align="center" gap="2">
                      <Text size="3" weight="bold">
                        {bill.name}
                      </Text>
                      {bill.is_variable && (
                        <Text size="1" color="gray">
                          (est.)
                        </Text>
                      )}
                    </Flex>
                    <Text size="1" color="gray">
                      {frequencyLabel(bill.frequency)} — Due day {bill.due_day}
                      {bill.category_name && ` — ${bill.category_name}`}
                    </Text>
                  </Flex>
                  <Flex align="center" gap="3">
                    <Text size="3" weight="bold" className={styles.nowrap}>
                      {formatCurrency(bill.amount)}
                    </Text>
                    <IconButton
                      variant="ghost"
                      size="1"
                      color="gray"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedBill(bill)
                      }}
                      aria-label="View details"
                    >
                      <Eye size={14} />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      size="1"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(bill.id)
                      }}
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Flex>
                </Flex>
              </Card>
            ))}
          </Flex>

          <Dialog.Root open={!!selectedBill} onOpenChange={(o) => !o && setSelectedBill(null)}>
            <Dialog.Content maxWidth="520px">
              <Flex align="center" justify="between">
                <Dialog.Title>Bill Details</Dialog.Title>
                <IconButton variant="soft" size="2" onClick={openEdit} aria-label="Edit bill">
                  <Pencil size={16} />
                </IconButton>
              </Flex>
              {selectedBill && <BillDetail bill={selectedBill} />}
            </Dialog.Content>
          </Dialog.Root>

          <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
            <Dialog.Content maxWidth="400px">
              <Dialog.Title>Edit Bill</Dialog.Title>
              <Flex direction="column" gap="3" mt="3">
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">
                    Name
                  </Text>
                  <TextField.Root
                    placeholder="e.g. Rent"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">
                    Amount
                  </Text>
                  <TextField.Root
                    type="number"
                    placeholder="1200"
                    value={editBillAmount}
                    onChange={(e) => setEditBillAmount(e.target.value)}
                  >
                    <TextField.Slot side="left">$</TextField.Slot>
                  </TextField.Root>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">
                    Account
                  </Text>
                  <Select.Root value={editAccountId} onValueChange={setEditAccountId}>
                    <Select.Trigger placeholder="Select account" />
                    <Select.Content>
                      {accounts.map((a) => (
                        <Select.Item key={a.id} value={String(a.id)}>
                          {a.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Flex gap="3">
                  <Box className={styles.flex1}>
                    <Flex direction="column" gap="1">
                      <Text size="2" weight="medium">
                        Frequency
                      </Text>
                      <Select.Root value={editFrequency} onValueChange={setEditFrequency}>
                        <Select.Trigger />
                        <Select.Content>
                          <Select.Item value="weekly">Weekly</Select.Item>
                          <Select.Item value="biweekly">Biweekly</Select.Item>
                          <Select.Item value="monthly">Monthly</Select.Item>
                          <Select.Item value="quarterly">Quarterly</Select.Item>
                          <Select.Item value="yearly">Yearly</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    </Flex>
                  </Box>
                  <Box className={styles.colWidth100}>
                    <Flex direction="column" gap="1">
                      <Text size="2" weight="medium">
                        Due Day
                      </Text>
                      <TextField.Root
                        type="number"
                        min={1}
                        max={31}
                        placeholder="1"
                        value={editDueDay}
                        onChange={(e) => setEditDueDay(e.target.value)}
                      />
                    </Flex>
                  </Box>
                </Flex>
                <Text as="label" size="2">
                  <Flex align="center" gap="2">
                    <Checkbox
                      checked={editIsVariable}
                      onCheckedChange={(v) => setEditIsVariable(v === true)}
                    />
                    <Text>Variable amount (estimated)</Text>
                  </Flex>
                </Text>
                <Button onClick={handleUpdate} loading={savingEdit} size="3" mt="2">
                  Save Changes
                </Button>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
        </>
      )}
    </Box>
  )
}
