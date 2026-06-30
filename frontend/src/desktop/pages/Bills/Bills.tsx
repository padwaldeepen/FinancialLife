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
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Bills.module.css'

export const Bills = (): JSX.Element => {
  const { bills, upcoming, loading, fetchBills, fetchUpcomingBills, createBill, deleteBill } =
    useBoundStore(
      useShallow((s) => ({
        bills: s.bills.items as any[],
        upcoming: s.bills.upcoming as any[],
        loading: s.bills.loading,
        fetchBills: s.fetchBills,
        fetchUpcomingBills: s.fetchUpcomingBills,
        createBill: s.createBill,
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
      <Flex align="center" justify="between" mb="5">
        <Heading size="6">Bills</Heading>
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
          <Text size="4" weight="medium">
            No bills yet
          </Text>
          <Text size="2" color="gray">
            Add your recurring expenses to track them
          </Text>
        </Flex>
      ) : (
        <>
          {bills.length > 0 && upcoming.length > 0 && (
            <Card mb="4" className={styles.upcomingCard}>
              <Heading size="3" mb="3">
                Upcoming (next 30 days)
              </Heading>
              <Flex direction="column" gap="2">
                {upcoming.map((bill: any) => (
                  <Flex key={bill.id} align="center" justify="between" className={styles.billRow}>
                    <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
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
                      ${bill.amount.toFixed(2)}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Card>
          )}

          <Heading size="4" mb="3">
            All Bills
          </Heading>
          <Flex direction="column" gap="3">
            {bills.map((bill: any) => (
              <Card key={bill.id} size="2">
                <Flex align="center" justify="between">
                  <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
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
                    <Text size="3" weight="bold" style={{ whiteSpace: 'nowrap' }}>
                      ${bill.amount.toFixed(2)}
                    </Text>
                    <IconButton
                      variant="ghost"
                      size="1"
                      color="red"
                      onClick={() => handleDelete(bill.id)}
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Flex>
                </Flex>
              </Card>
            ))}
          </Flex>
        </>
      )}
    </Box>
  )
}
