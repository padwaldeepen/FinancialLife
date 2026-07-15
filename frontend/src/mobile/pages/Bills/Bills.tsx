import { useState, useEffect, type JSX } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Card,
  Dialog,
  TextField,
  Select,
  IconButton,
  Checkbox,
} from '@radix-ui/themes'
import { Plus, Trash2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { BillDetail } from './BillDetail/BillDetail.tsx'
import styles from './Bills.module.css'

export const Bills = (): JSX.Element => {
  const { bills, loading, fetchBills, fetchUpcomingBills, createBill, updateBill, deleteBill } =
    useBoundStore(
      useShallow((s) => ({
        bills: s.bills.items as any[],
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
      <Flex align="center" justify="between" mb="4">
        <Heading size="5">Bills</Heading>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger>
            <Button size="2">
              <Plus size={16} /> Add
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
                <Box style={{ flex: 1 }}>
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
                <Box style={{ width: 100 }}>
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
        <Text color="gray">Loading...</Text>
      ) : bills.length === 0 ? (
        <Flex direction="column" align="center" gap="2" py="8">
          <Text size="3" weight="medium">
            No bills yet
          </Text>
          <Text size="2" color="gray">
            Add your recurring expenses
          </Text>
        </Flex>
      ) : (
        <Box>
          <Flex direction="column" gap="3">
            {bills.map((bill: any) => (
              <Card
                key={bill.id}
                size="2"
                onClick={() => setSelectedBill(bill)}
                style={{ cursor: 'pointer' }}
              >
                <Flex direction="column" gap="2">
                  <Flex align="center" justify="between">
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
                  <Flex align="center" justify="between">
                    <Text size="1" color="gray">
                      {frequencyLabel(bill.frequency)} — Day {bill.due_day}
                      {bill.category_name && ` — ${bill.category_name}`}
                    </Text>
                    <Text size="3" weight="bold">
                      ${bill.amount.toFixed(2)}
                    </Text>
                  </Flex>
                </Flex>
              </Card>
            ))}
          </Flex>

          <Dialog.Root open={!!selectedBill} onOpenChange={(o) => !o && setSelectedBill(null)}>
            <Dialog.Content maxWidth="400px">
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
                  <Box style={{ flex: 1 }}>
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
                  <Box style={{ width: 100 }}>
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
        </Box>
      )}
    </Box>
  )
}
