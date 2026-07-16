import { useState, useEffect, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Flex,
  Text,
  Card,
  Switch,
  Button,
  IconButton,
  Dialog,
  TextField,
  Select,
} from '@radix-ui/themes'
import {
  Moon,
  Sun,
  LogOut,
  User,
  Mail,
  Plus,
  Pencil,
  Trash2,
  Wallet,
  PiggyBank,
  CreditCard,
  TrendingUp,
  DollarSign,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useAppTheme } from '../../../theme.tsx'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import styles from './Settings.module.css'

const accountIcons: Record<string, JSX.Element> = {
  checking: <Wallet size={18} />,
  savings: <PiggyBank size={18} />,
  credit: <CreditCard size={18} />,
  cash: <Wallet size={18} />,
  investment: <TrendingUp size={18} />,
}

const accountTypes = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
]

interface AccountForm {
  name: string
  type: string
  currency: string
}

const defaultForm: AccountForm = { name: '', type: 'checking', currency: 'USD' }

export const Settings = (): JSX.Element => {
  const {
    user,
    logout,
    accounts,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    budgets,
    fetchBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
  } = useBoundStore(
    useShallow((s) => ({
      user: s.auth.user,
      logout: s.logout,
      accounts: s.accounts.items,
      fetchAccounts: s.fetchAccounts,
      createAccount: s.createAccount,
      updateAccount: s.updateAccount,
      deleteAccount: s.deleteAccount,
      budgets: s.budgets.items,
      fetchBudgets: s.fetchBudgets,
      createBudget: s.createBudget,
      updateBudget: s.updateBudget,
      deleteBudget: s.deleteBudget,
    })),
  )
  const { dark, toggle } = useAppTheme()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<AccountForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const [budgetId, setBudgetId] = useState<number | null>(null)
  const [budgetName, setBudgetName] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetPeriod, setBudgetPeriod] = useState('monthly')
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetDeleteId, setBudgetDeleteId] = useState<number | null>(null)
  const [budgetDeleting, setBudgetDeleting] = useState(false)

  useEffect(() => {
    fetchAccounts()
    fetchBudgets()
  }, [fetchAccounts, fetchBudgets])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (account: (typeof accounts)[0]) => {
    setEditingId(account.id)
    setForm({ name: account.name, type: account.type, currency: account.currency })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await updateAccount(editingId, form)
        toast.success('Account updated')
      } else {
        await createAccount(form)
        toast.success('Account created')
      }
      setDialogOpen(false)
    } catch {
      toast.error('Failed to save account')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete account "${name}"? This cannot be undone.`)) return
    deleteAccount(id)
    toast.success('Account deleted')
  }

  const openBudgetCreate = () => {
    setBudgetId(null)
    setBudgetName('')
    setBudgetAmount('')
    setBudgetPeriod('monthly')
    setBudgetDialogOpen(true)
  }

  const openBudgetEdit = (budget: (typeof budgets)[0]) => {
    setBudgetId(budget.id)
    setBudgetName(budget.name)
    setBudgetAmount(String(budget.amount))
    setBudgetPeriod(budget.period)
    setBudgetDialogOpen(true)
  }

  const handleBudgetSave = async () => {
    if (!budgetName.trim() || !budgetAmount) return
    setBudgetSaving(true)
    try {
      if (budgetId) {
        await updateBudget(budgetId, {
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

  const budgetPeriodLabel: Record<string, string> = {
    monthly: 'Monthly',
    weekly: 'Weekly',
    yearly: 'Yearly',
  }

  return (
    <Box className={styles.page}>
      <span className={styles.pageTitle}>Settings</span>

      <Box className={styles.section}>
        <Text size="2" weight="bold" color="gray" className={styles.sectionTitle}>
          Profile
        </Text>
        <Card className={styles.card}>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              <User size={18} />
              <Box className={styles.labelText}>
                <Text size="2">Name</Text>
                <Text size="2" color="gray">
                  {user?.name || 'Not set'}
                </Text>
              </Box>
            </Flex>
          </Box>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              <Mail size={18} />
              <Box className={styles.labelText}>
                <Text size="2">Email</Text>
                <Text size="2" color="gray">
                  {user?.email}
                </Text>
              </Box>
            </Flex>
          </Box>
        </Card>
      </Box>

      <Box className={styles.section}>
        <div className={styles.sectionTitle}>Profile</div>
        <Card className={styles.card}>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              <User size={18} />
              <Box className={styles.labelText}>
                <span className={styles.labelTextPrimary}>Name</span>
                <span className={styles.labelTextSecondary}>{user?.name || 'Not set'}</span>
              </Box>
            </Flex>
          </Box>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              <Mail size={18} />
              <Box className={styles.labelText}>
                <span className={styles.labelTextPrimary}>Email</span>
                <span className={styles.labelTextSecondary}>{user?.email}</span>
              </Box>
            </Flex>
          </Box>
        </Card>
      </Box>

      <Box className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Accounts</div>
          <Button size="1" variant="soft" onClick={openCreate}>
            <Plus size={14} /> Add
          </Button>
        </div>
        {accounts.length === 0 ? (
          <Text color="gray" size="2">
            No accounts yet
          </Text>
        ) : (
          <Card className={styles.card}>
            {accounts.map((account) => (
              <Box key={account.id} className={styles.row}>
                <Flex className={styles.labelGroup}>
                  {accountIcons[account.type] || <Wallet size={18} />}
                  <Box className={styles.labelText}>
                    <span className={styles.labelTextPrimary}>{account.name}</span>
                    <span className={`${styles.labelTextSecondary} ${styles.capitalize}`}>
                      {account.type} — {formatCurrency(account.balance)}
                    </span>
                  </Box>
                </Flex>
                <Flex gap="1">
                  <IconButton
                    variant="ghost"
                    size="1"
                    onClick={() => openEdit(account)}
                    aria-label="Edit"
                  >
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    size="1"
                    color="red"
                    onClick={() => handleDelete(account.id, account.name)}
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </Flex>
              </Box>
            ))}
          </Card>
        )}
      </Box>

      <Box className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Budgets</div>
          <Button size="1" variant="soft" onClick={openBudgetCreate}>
            <Plus size={14} /> Add
          </Button>
        </div>
        {budgets.length === 0 ? (
          <Text color="gray" size="2">
            No budgets yet
          </Text>
        ) : (
          <Card className={styles.card}>
            {budgets.map((budget) => {
              const pct = budget.amount > 0 ? Math.round((budget.spent / budget.amount) * 100) : 0
              return (
                <Box key={budget.id} className={styles.row}>
                  <Flex className={styles.labelGroup}>
                    <DollarSign size={18} />
                    <Box className={styles.labelText}>
                      <Flex align="center" gap="2">
                        <Text size="2">{budget.name}</Text>
                      </Flex>
                      <Text size="1" color="gray">
                        {budgetPeriodLabel[budget.period] || budget.period} &middot; $
                        {budget.spent.toFixed(0)} / ${budget.amount.toFixed(0)} ({pct}%)
                      </Text>
                    </Box>
                  </Flex>
                  <Flex gap="1">
                    <IconButton
                      variant="ghost"
                      size="1"
                      onClick={() => openBudgetEdit(budget)}
                      aria-label="Edit"
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      size="1"
                      color="red"
                      onClick={() => setBudgetDeleteId(budget.id)}
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Flex>
                </Box>
              )
            })}
          </Card>
        )}
      </Box>

      <Box className={styles.section}>
        <div className={styles.sectionTitle}>Appearance</div>
        <Card className={styles.card}>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              {dark ? <Moon size={18} /> : <Sun size={18} />}
              <Box className={styles.labelText}>
                <span className={styles.labelTextPrimary}>Dark mode</span>
                <span className={styles.labelTextSecondary}>{dark ? 'On' : 'Off'}</span>
              </Box>
            </Flex>
            <Switch checked={dark} onCheckedChange={toggle} />
          </Box>
        </Card>
      </Box>

      <Box className={styles.section}>
        <div className={styles.sectionTitle}>Account</div>
        <Card className={styles.card}>
          <Box className={styles.logoutRow}>
            <Button variant="soft" color="red" onClick={handleLogout}>
              <LogOut size={16} />
              Log out
            </Button>
          </Box>
        </Card>
      </Box>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Content aria-describedby={undefined}>
          <Dialog.Title>{editingId ? 'Edit Account' : 'Add Account'}</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <TextField.Root
              placeholder="Account name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Select.Root value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <Select.Trigger />
              <Select.Content>
                {accountTypes.map((t) => (
                  <Select.Item key={t.value} value={t.value}>
                    {t.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <TextField.Root
              placeholder="Currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
            <Flex gap="2" justify="end">
              <Button variant="soft" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {editingId ? 'Save' : 'Create'}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Budget Create/Edit Dialog */}
      <Dialog.Root open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <Dialog.Content aria-describedby={undefined}>
          <Dialog.Title>{budgetId ? 'Edit Budget' : 'Add Budget'}</Dialog.Title>
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
                <Select.Item value="monthly">Monthly</Select.Item>
                <Select.Item value="weekly">Weekly</Select.Item>
                <Select.Item value="yearly">Yearly</Select.Item>
              </Select.Content>
            </Select.Root>
            <Flex gap="2" justify="end">
              <Button variant="soft" onClick={() => setBudgetDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBudgetSave} loading={budgetSaving}>
                {budgetId ? 'Save' : 'Create'}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Budget Delete Confirmation */}
      <Dialog.Root
        open={budgetDeleteId !== null}
        onOpenChange={(o) => {
          if (!o) setBudgetDeleteId(null)
        }}
      >
        <Dialog.Content aria-describedby={undefined} className={styles.maxWidth380}>
          <Dialog.Title>Delete Budget</Dialog.Title>
          <Text size="2" mt="2">
            Are you sure you want to delete this budget? This action cannot be undone.
          </Text>
          <Flex gap="3" mt="4" justify="end">
            <Button variant="soft" color="gray" onClick={() => setBudgetDeleteId(null)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleBudgetDelete} disabled={budgetDeleting}>
              {budgetDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
