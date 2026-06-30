import { useState, useEffect, type JSX } from 'react'
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
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useAppTheme } from '../../../theme.tsx'
import { useBoundStore } from '../../../store/useBoundStore.ts'
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
  const { user, logout, accounts, fetchAccounts, createAccount, updateAccount, deleteAccount } =
    useBoundStore(
      useShallow((s) => ({
        user: s.auth.user,
        logout: s.logout,
        accounts: s.accounts.items,
        fetchAccounts: s.fetchAccounts,
        createAccount: s.createAccount,
        updateAccount: s.updateAccount,
        deleteAccount: s.deleteAccount,
      })),
    )
  const { dark, toggle } = useAppTheme()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<AccountForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

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
    if (!window.confirm(`Delete account "${name}"?`)) return
    deleteAccount(id)
    toast.success('Account deleted')
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
                    <Text size="1" color="gray" style={{ textTransform: 'capitalize' }}>
                      {account.type} — ${account.balance.toFixed(2)}
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
    </Box>
  )
}
