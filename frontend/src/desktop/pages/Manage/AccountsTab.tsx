import { useState, useEffect, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  Card,
  Button,
  IconButton,
  Dialog,
  AlertDialog,
  TextField,
  Select,
} from '@radix-ui/themes'
import { Plus, Pencil, Trash2, Wallet, PiggyBank, CreditCard, TrendingUp } from 'lucide-react'
import toast from '../../../shared/utils/toast.ts'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import type { Account } from '../../../store/slices/accountsSlice.ts'
import styles from './Manage.module.css'

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

const defaultForm = (): AccountForm => ({ name: '', type: 'checking', currency: 'USD' })

export const AccountsTab = (): JSX.Element => {
  const currency = useActiveCurrency()
  const { accounts, fetchAccounts, createAccount, updateAccount, deleteAccount } = useBoundStore(
    useShallow((s) => ({
      accounts: s.accounts.items,
      fetchAccounts: s.fetchAccounts,
      createAccount: s.createAccount,
      updateAccount: s.updateAccount,
      deleteAccount: s.deleteAccount,
    })),
  )

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<AccountForm>(defaultForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteName, setDeleteName] = useState('')

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm())
    setDialogOpen(true)
  }

  const openEdit = (account: Account) => {
    setEditingId(account.id)
    setForm({ name: account.name, type: account.type, currency: account.currency })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId !== null) {
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

  const confirmDelete = async () => {
    if (deleteId === null) return
    try {
      await deleteAccount(deleteId)
      toast.success('Account deleted')
    } catch {
      toast.error('Failed to delete account')
    } finally {
      setDeleteId(null)
      setDeleteName('')
    }
  }

  return (
    <Box>
      <Flex className={styles.sectionHeader}>
        <Text as="div" className={styles.sectionTitle}>
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
                  <Text size="2" weight="medium">
                    {account.name}
                  </Text>
                  <Text size="2" color="gray" className={styles.capitalize}>
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
                  onClick={() => {
                    setDeleteId(account.id)
                    setDeleteName(account.name)
                  }}
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </IconButton>
              </Flex>
            </Box>
          ))}
        </Card>
      )}

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Content aria-describedby={undefined} maxWidth="400px">
          <Dialog.Title>{editingId !== null ? 'Edit Account' : 'Add Account'}</Dialog.Title>
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
                {editingId !== null ? 'Save' : 'Create'}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <AlertDialog.Root
        open={deleteId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteId(null)
            setDeleteName('')
          }
        }}
      >
        <AlertDialog.Content className={styles.maxWidth380}>
          <AlertDialog.Title>Delete Account</AlertDialog.Title>
          <AlertDialog.Description size="2">
            Delete account &quot;{deleteName}&quot;? This cannot be undone.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button color="red" onClick={confirmDelete}>
                Delete
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  )
}
