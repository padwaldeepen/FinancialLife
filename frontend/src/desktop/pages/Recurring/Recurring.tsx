import { useState, useEffect, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  Button,
  Card,
  Dialog,
  AlertDialog,
  IconButton,
  Table,
  Progress,
  TextField,
  Select,
} from '@radix-ui/themes'
import { Plus, Trash2, Pencil } from 'lucide-react'
import toast from '../../../shared/utils/toast.ts'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import {
  centsToDollars,
  frequencyLabel,
  monthlyEquivalentCents,
  sumMonthlyEquivalentCents,
} from '../../../shared/utils/money.ts'
import type { Bill } from '../../../store/slices/billsSlice.ts'
import type { Budget } from '../../../store/slices/budgetsSlice.ts'
import { BillFormDialog } from './BillFormDialog.tsx'
import { BillDetail } from './BillDetail/BillDetail.tsx'
import styles from './Recurring.module.css'

const budgetPeriodLabel: Record<string, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  yearly: 'Yearly',
}

export const Recurring = (): JSX.Element => {
  const currency = useActiveCurrency()
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
      bills: s.bills.items,
      upcoming: s.bills.upcoming,
      loading: s.bills.loading,
      fetchBills: s.fetchBills,
      fetchUpcomingBills: s.fetchUpcomingBills,
      createBill: s.createBill,
      updateBill: s.updateBill,
      deleteBill: s.deleteBill,
    })),
  )
  const { accounts, fetchAccounts } = useBoundStore(
    useShallow((s) => ({ accounts: s.accounts.items, fetchAccounts: s.fetchAccounts })),
  )
  const { budgets, budgetsLoading, fetchBudgets, createBudget, updateBudget, deleteBudget } =
    useBoundStore(
      useShallow((s) => ({
        budgets: s.budgets.items,
        budgetsLoading: s.budgets.loading,
        fetchBudgets: s.fetchBudgets,
        createBudget: s.createBudget,
        updateBudget: s.updateBudget,
        deleteBudget: s.deleteBudget,
      })),
    )

  useEffect(() => {
    fetchBills()
    fetchUpcomingBills()
    fetchAccounts()
    fetchBudgets()
  }, [fetchBills, fetchUpcomingBills, fetchAccounts, fetchBudgets])

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [budgetName, setBudgetName] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetPeriod, setBudgetPeriod] = useState('monthly')
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetDeleteId, setBudgetDeleteId] = useState<number | null>(null)
  const [budgetDeleting, setBudgetDeleting] = useState(false)

  const openBudgetCreate = () => {
    setEditingBudget(null)
    setBudgetName('')
    setBudgetAmount('')
    setBudgetPeriod('monthly')
    setBudgetDialogOpen(true)
  }

  const openBudgetEdit = (budget: Budget) => {
    setEditingBudget(budget)
    setBudgetName(budget.name)
    setBudgetAmount(String(budget.amount))
    setBudgetPeriod(budget.period)
    setBudgetDialogOpen(true)
  }

  const handleBudgetSave = async () => {
    if (!budgetName.trim() || !budgetAmount) return
    setBudgetSaving(true)
    try {
      if (editingBudget) {
        await updateBudget(editingBudget.id, {
          name: budgetName.trim(),
          amount: parseFloat(budgetAmount),
          period: budgetPeriod,
        })
        toast.success('Budget updated')
      } else {
        await createBudget({
          name: budgetName.trim(),
          amount: parseFloat(budgetAmount),
          period: budgetPeriod,
        })
        toast.success('Budget created')
      }
      setBudgetDialogOpen(false)
    } catch {
      toast.error('Failed to save budget')
    } finally {
      setBudgetSaving(false)
    }
  }

  const handleBudgetDelete = async () => {
    if (budgetDeleteId === null) return
    setBudgetDeleting(true)
    try {
      await deleteBudget(budgetDeleteId)
      toast.success('Budget deleted')
      setBudgetDeleteId(null)
    } catch {
      toast.error('Failed to delete budget')
    } finally {
      setBudgetDeleting(false)
    }
  }

  const [formOpen, setFormOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [saving, setSaving] = useState(false)

  const totalMonthlyCents = sumMonthlyEquivalentCents(bills.filter((b) => b.is_active))

  const openCreate = () => {
    setEditingBill(null)
    setFormOpen(true)
  }

  const openEdit = (bill: Bill) => {
    setEditingBill(bill)
    setFormOpen(true)
    setSelectedBill(null)
  }

  const handleSubmit = async (values: {
    name: string
    amount: number
    frequency: string
    due_day: number
    account_id: number
    is_variable: boolean
  }) => {
    setSaving(true)
    try {
      if (editingBill) {
        await updateBill(editingBill.id, values)
        toast.success('Bill updated')
      } else {
        await createBill(values)
        toast.success('Bill created')
      }
      await fetchUpcomingBills(30, { force: true })
      setFormOpen(false)
    } catch (error: unknown) {
      const detail =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined
      toast.error(detail || 'Failed to save bill')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteBill(id)
      await fetchUpcomingBills(30, { force: true })
      toast.success('Bill deleted')
    } catch {
      toast.error('Failed to delete bill')
    }
  }

  return (
    <Box className={styles.page}>
      <Flex className={styles.pageHeader}>
        <Text as="div" className={styles.pageTitle}>
          Recurring
        </Text>
        <Button size="2" onClick={openCreate}>
          <Plus size={16} /> Add Bill
        </Button>
      </Flex>

      {loading ? (
        <Flex direction="column" gap="3" p="4">
          <Box
            className="skeleton"
            style={{ height: 20, width: '100%', borderRadius: 'var(--radius-2)' }}
          />
          <Box
            className="skeleton"
            style={{ height: 20, width: '80%', borderRadius: 'var(--radius-2)' }}
          />
          <Box
            className="skeleton"
            style={{ height: 20, width: '60%', borderRadius: 'var(--radius-2)' }}
          />
        </Flex>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Card mb="4" className={styles.upcomingCard}>
              <Text as="div" className={styles.sectionTitle}>
                Upcoming (next 30 days)
              </Text>
              <Flex direction="column" gap="2">
                {upcoming.map((bill) => (
                  <Flex key={bill.id} align="center" justify="between" className={styles.billRow}>
                    <Flex direction="column" gap="1" className={styles.flex1Min0}>
                      <Text size="2" weight="medium">
                        {bill.name}
                      </Text>
                      <Text size="1" color="gray">
                        {bill.has_paid
                          ? 'Paid'
                          : bill.days_until === 0
                            ? 'Due today'
                            : `In ${bill.days_until} day${bill.days_until === 1 ? '' : 's'}`}
                        {bill.is_variable && ' (estimated)'}
                      </Text>
                    </Flex>
                    <Text size="2" weight="bold" color={bill.has_paid ? 'green' : undefined}>
                      {bill.has_paid ? '✓ ' : ''}
                      {formatCurrency(bill.amount, currency)}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Card>
          )}

          <Flex align="center" justify="between" mb="3">
            <Text as="div" className={styles.sectionTitle}>
              All Recurring
            </Text>
            <Text size="2" color="gray">
              Total per month{' '}
              <Text weight="bold" color="gray" highContrast>
                {formatCurrency(centsToDollars(totalMonthlyCents), currency)}
              </Text>
            </Text>
          </Flex>

          {bills.length === 0 ? (
            <Flex className={styles.emptyState} direction="column">
              <Text as="div" className={styles.emptyTitle}>
                No bills yet
              </Text>
              <Text as="div" className={styles.emptyHint}>
                Add your recurring expenses to track them
              </Text>
            </Flex>
          ) : (
            <Table.Root variant="surface" mb="6">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Frequency</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">Amount</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">Monthly equivalent</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {bills.map((bill) => (
                  <Table.Row
                    key={bill.id}
                    className={styles.tableRow}
                    onClick={() => setSelectedBill(bill)}
                  >
                    <Table.Cell>
                      {bill.name}
                      {bill.is_variable && (
                        <Text size="1" color="gray">
                          {' '}
                          (est.)
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>{frequencyLabel(bill.frequency)}</Table.Cell>
                    <Table.Cell justify="end">{formatCurrency(bill.amount, currency)}</Table.Cell>
                    <Table.Cell justify="end">
                      {formatCurrency(
                        centsToDollars(monthlyEquivalentCents(bill.amount, bill.frequency)),
                        currency,
                      )}
                    </Table.Cell>
                    <Table.Cell>
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
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}

          <Flex align="center" justify="between" mb="3">
            <Text as="div" className={styles.sectionTitle}>
              Budgets
            </Text>
            <Button size="1" variant="soft" onClick={openBudgetCreate}>
              <Plus size={14} /> Add
            </Button>
          </Flex>
          {budgetsLoading ? (
            <Box
              className="skeleton"
              style={{ height: 60, width: '100%', borderRadius: 'var(--radius-2)' }}
            />
          ) : budgets.length === 0 ? (
            <Text color="gray" size="2">
              No budgets yet
            </Text>
          ) : (
            <Flex direction="column" gap="3">
              {budgets.map((budget) => {
                const pct = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0
                const overBudget = pct > 100
                // Accent (orange) only when the budget needs attention (approaching or
                // over its limit) — accent means "act here", not a default decoration
                // (design-system.md §1.4). Comfortably on-track stays neutral slate.
                const progressColor = overBudget ? 'red' : pct >= 80 ? 'orange' : 'gray'
                return (
                  <Card key={budget.id} className={styles.budgetCard}>
                    <Flex justify="between" align="center" mb="2">
                      <Text weight="medium">{budget.name}</Text>
                      <Flex align="center" gap="3">
                        <Text size="2" color={overBudget ? 'red' : 'gray'}>
                          {formatCurrency(budget.spent, currency)} /{' '}
                          {formatCurrency(budget.amount, currency)}
                        </Text>
                        <Flex gap="1">
                          <IconButton
                            variant="ghost"
                            size="1"
                            onClick={() => openBudgetEdit(budget)}
                            aria-label="Edit budget"
                          >
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton
                            variant="ghost"
                            size="1"
                            color="red"
                            onClick={() => setBudgetDeleteId(budget.id)}
                            aria-label="Delete budget"
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Flex>
                      </Flex>
                    </Flex>
                    <Progress value={Math.min(pct, 100)} color={progressColor} />
                  </Card>
                )
              })}
            </Flex>
          )}
        </>
      )}

      {/* Budget Create/Edit Dialog */}
      <Dialog.Root open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <Dialog.Content aria-describedby={undefined} maxWidth="400px">
          <Dialog.Title>{editingBudget ? 'Edit Budget' : 'Add Budget'}</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <TextField.Root
              placeholder="Budget name"
              value={budgetName}
              onChange={(e) => setBudgetName(e.target.value)}
            />
            <TextField.Root
              type="number"
              placeholder="Amount"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
            >
              <TextField.Slot side="left">$</TextField.Slot>
            </TextField.Root>
            <Select.Root value={budgetPeriod} onValueChange={setBudgetPeriod}>
              <Select.Trigger />
              <Select.Content>
                {Object.entries(budgetPeriodLabel).map(([value, label]) => (
                  <Select.Item key={value} value={value}>
                    {label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Flex gap="2" justify="end">
              <Button variant="soft" onClick={() => setBudgetDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBudgetSave} loading={budgetSaving}>
                {editingBudget ? 'Save' : 'Create'}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Budget Delete Confirmation */}
      <AlertDialog.Root
        open={budgetDeleteId !== null}
        onOpenChange={(o) => {
          if (!o) setBudgetDeleteId(null)
        }}
      >
        <AlertDialog.Content maxWidth="380px">
          <AlertDialog.Title>Delete Budget</AlertDialog.Title>
          <AlertDialog.Description size="2">
            Are you sure you want to delete this budget? This action cannot be undone.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button color="red" onClick={handleBudgetDelete} disabled={budgetDeleting}>
                {budgetDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>

      <BillFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        bill={editingBill}
        accounts={accounts}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <Dialog.Root open={!!selectedBill} onOpenChange={(o) => !o && setSelectedBill(null)}>
        <Dialog.Content maxWidth="520px">
          <Flex align="center" justify="between">
            <Dialog.Title>Bill Details</Dialog.Title>
            <IconButton
              variant="soft"
              size="2"
              onClick={() => selectedBill && openEdit(selectedBill)}
              aria-label="Edit bill"
            >
              <Pencil size={16} />
            </IconButton>
          </Flex>
          {selectedBill && <BillDetail bill={selectedBill} />}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
