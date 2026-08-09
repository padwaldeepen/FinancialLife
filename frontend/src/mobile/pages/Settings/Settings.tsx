import { useEffect, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Flex,
  Text,
  Heading,
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
  Sparkles,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppTheme } from '../../../theme.tsx'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
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

export const Settings = (): JSX.Element => {
  const currency = useActiveCurrency()
  const {
    user,
    logout,
    fetchCurrentUser,
    updateAiCloudEnabled,
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
      logout: s.auth.logout,
      fetchCurrentUser: s.auth.fetchCurrentUser,
      updateAiCloudEnabled: s.auth.updateAiCloudEnabled,
      accounts: s.accounts.items,
      fetchAccounts: s.accounts.fetchAccounts,
      createAccount: s.accounts.createAccount,
      updateAccount: s.accounts.updateAccount,
      deleteAccount: s.accounts.deleteAccount,
      budgets: s.budgets.items,
      fetchBudgets: s.budgets.fetchBudgets,
      createBudget: s.budgets.createBudget,
      updateBudget: s.budgets.updateBudget,
      deleteBudget: s.budgets.deleteBudget,
    })),
  )
  const { dark, toggle } = useAppTheme()
  const navigate = useNavigate()

  const {
    dialogOpen,
    editingId,
    form,
    saving,
    deleteId,
    deleteName,
    openAccountCreate,
    openAccountEdit,
    setAccountDialogOpen,
    setAccountFormField,
    setAccountSaving,
    startAccountDelete,
    cancelAccountDelete,
  } = useBoundStore(useShallow((s) => s.accountForm))

  const {
    dialogOpen: budgetDialogOpen,
    budgetId,
    name: budgetName,
    amount: budgetAmount,
    period: budgetPeriod,
    saving: budgetSaving,
    deleteId: budgetDeleteId,
    deleting: budgetDeleting,
    openBudgetCreate,
    openBudgetEdit,
    setBudgetDialogOpen,
    setBudgetName,
    setBudgetAmount,
    setBudgetPeriod,
    setBudgetSaving,
    startBudgetDelete,
    cancelBudgetDelete,
    setBudgetDeleting,
  } = useBoundStore(useShallow((s) => s.budgetForm))

  const handleAiCloudToggle = async (enabled: boolean) => {
    try {
      await updateAiCloudEnabled(enabled)
    } catch {
      // toast handled in store
    }
  }

  useEffect(() => {
    fetchAccounts()
    fetchBudgets()
    if (user && user.ai_cloud_enabled === undefined) fetchCurrentUser()
  }, [fetchAccounts, fetchBudgets, fetchCurrentUser, user])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const openCreate = openAccountCreate

  const openEdit = (account: (typeof accounts)[0]) => openAccountEdit(account)

  const handleSave = async () => {
    if (!form.name.trim()) return
    setAccountSaving(true)
    try {
      if (editingId) {
        await updateAccount(editingId, form)
      } else {
        await createAccount(form)
      }
      setAccountDialogOpen(false)
    } catch {
      // toast handled in store
    } finally {
      setAccountSaving(false)
    }
  }

  const handleDelete = (id: number, name: string) => startAccountDelete(id, name)

  const confirmDelete = async () => {
    if (deleteId === null) return
    try {
      await deleteAccount(deleteId)
    } catch {
      // toast handled in store
    } finally {
      cancelAccountDelete()
    }
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
      } else {
        await createBudget({
          name: budgetName.trim(),
          amount: parseFloat(budgetAmount),
          period: budgetPeriod,
        })
      }
      setBudgetDialogOpen(false)
    } catch {
      // toast handled in store
    } finally {
      setBudgetSaving(false)
    }
  }

  const handleBudgetDelete = async () => {
    if (budgetDeleteId === null) return
    setBudgetDeleting(true)
    try {
      await deleteBudget(budgetDeleteId)
      cancelBudgetDelete()
    } catch {
      // toast handled in store
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
      <Heading size="5" mb="4">
        Settings
      </Heading>

      <Box className={styles.section}>
        <Text size="1" weight="bold" color="gray" className={styles.sectionTitle}>
          Profile
        </Text>
        <Card className={styles.card}>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              <User size={18} />
              <Box className={styles.labelText}>
                <Text size="2">Name</Text>
                <Text size="2" color="gray">
                  {user?.full_name || 'Not set'}
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
        <Flex align="center" justify="between" mb="1">
          <Text size="1" weight="bold" color="gray" className={styles.sectionTitle}>
            Accounts
          </Text>
          <Button size="1" variant="soft" onClick={openCreate}>
            <Plus size={14} /> Add
          </Button>
        </Flex>
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
                    <Text size="2">{account.name}</Text>
                    <Text size="1" color="gray" className={styles.capitalize}>
                      {account.type} — {formatCurrency(account.balance, currency)}
                    </Text>
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
        <Flex align="center" justify="between" mb="1">
          <Text size="1" weight="bold" color="gray" className={styles.sectionTitle}>
            Budgets
          </Text>
          <Button size="1" variant="soft" onClick={openBudgetCreate}>
            <Plus size={14} /> Add
          </Button>
        </Flex>
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
                      <Text size="2">{budget.name}</Text>
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
                      onClick={() => startBudgetDelete(budget.id)}
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
        <Text size="1" weight="bold" color="gray" className={styles.sectionTitle}>
          Appearance
        </Text>
        <Card className={styles.card}>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              {dark ? <Moon size={18} /> : <Sun size={18} />}
              <Box className={styles.labelText}>
                <Text size="2">Dark mode</Text>
                <Text size="1" color="gray">
                  {dark ? 'On' : 'Off'}
                </Text>
              </Box>
            </Flex>
            <Switch checked={dark} onCheckedChange={toggle} />
          </Box>
        </Card>
      </Box>

      <Box className={styles.section}>
        <Text size="1" weight="bold" color="gray" className={styles.sectionTitle}>
          AI &amp; Privacy
        </Text>
        <Card className={styles.card}>
          <Box className={styles.row}>
            <Flex className={styles.labelGroup}>
              <Sparkles size={18} />
              <Box className={styles.labelText}>
                <Text size="2">Cloud AI (Gemini)</Text>
                <Text size="1" color="gray">
                  On: your financial text goes to Google&apos;s AI (free tier may train on it). Off:
                  nothing leaves this machine.
                </Text>
              </Box>
            </Flex>
            <Switch
              checked={Boolean(user?.ai_cloud_enabled)}
              onCheckedChange={handleAiCloudToggle}
            />
          </Box>
        </Card>
      </Box>

      <Box className={styles.section}>
        <Text size="1" weight="bold" color="gray" className={styles.sectionTitle}>
          Account
        </Text>
        <Card className={styles.card}>
          <Box className={styles.logoutRow}>
            <Button variant="soft" color="red" onClick={handleLogout}>
              <LogOut size={16} />
              Log out
            </Button>
          </Box>
        </Card>
      </Box>

      <Dialog.Root open={dialogOpen} onOpenChange={setAccountDialogOpen}>
        <Dialog.Content aria-describedby={undefined}>
          <Dialog.Title>{editingId ? 'Edit Account' : 'Add Account'}</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <TextField.Root
              placeholder="Account name"
              value={form.name}
              onChange={(e) => setAccountFormField('name', e.target.value)}
            />
            <Select.Root value={form.type} onValueChange={(v) => setAccountFormField('type', v)}>
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
              onChange={(e) => setAccountFormField('currency', e.target.value)}
            />
            <Flex gap="2" justify="end">
              <Button variant="soft" onClick={() => setAccountDialogOpen(false)}>
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
          if (!o) cancelBudgetDelete()
        }}
      >
        <Dialog.Content aria-describedby={undefined} className={styles.maxWidth360}>
          <Dialog.Title>Delete Budget</Dialog.Title>
          <Text size="2" mt="2">
            Are you sure you want to delete this budget? This action cannot be undone.
          </Text>
          <Flex gap="3" mt="4" justify="end">
            <Button variant="soft" color="gray" onClick={() => cancelBudgetDelete()}>
              Cancel
            </Button>
            <Button color="red" onClick={handleBudgetDelete} disabled={budgetDeleting}>
              {budgetDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Account Delete Confirmation */}
      <Dialog.Root
        open={deleteId !== null}
        onOpenChange={(o) => {
          if (!o) cancelAccountDelete()
        }}
      >
        <Dialog.Content aria-describedby={undefined} className={styles.maxWidth360}>
          <Dialog.Title>Delete Account</Dialog.Title>
          <Text size="2" mt="2">
            Delete account &quot;{deleteName}&quot;? This cannot be undone.
          </Text>
          <Flex gap="3" mt="4" justify="end">
            <Button variant="soft" color="gray" onClick={() => cancelAccountDelete()}>
              Cancel
            </Button>
            <Button color="red" onClick={confirmDelete}>
              Delete
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
