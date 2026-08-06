import { useEffect, type JSX } from 'react'
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
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import type { Account } from '../../../store/slices/accountsSlice.ts'
import styles from './Manage.module.css'
import shared from '../../styles/shared.module.css'

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

export const AccountsTab = (): JSX.Element => {
  const currency = useActiveCurrency()
  const { accounts, fetchAccounts, createAccount, updateAccount, deleteAccount } = useBoundStore(
    useShallow((s) => ({
      accounts: s.accounts.items,
      fetchAccounts: s.accounts.fetchAccounts,
      createAccount: s.accounts.createAccount,
      updateAccount: s.accounts.updateAccount,
      deleteAccount: s.accounts.deleteAccount,
    })),
  )
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

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const openCreate = openAccountCreate

  const openEdit = (account: Account) => openAccountEdit(account)

  const handleSave = async () => {
    if (!form.name.trim()) return
    setAccountSaving(true)
    try {
      if (editingId !== null) {
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

  return (
    <Box>
      <Flex className={shared.sectionHeader}>
        <Text as="div" className={styles.sectionTitle}>
          Accounts
        </Text>
        <Button size="1" onClick={openCreate}>
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
                  onClick={() => startAccountDelete(account.id, account.name)}
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </IconButton>
              </Flex>
            </Box>
          ))}
        </Card>
      )}

      <Dialog.Root open={dialogOpen} onOpenChange={setAccountDialogOpen}>
        <Dialog.Content aria-describedby={undefined} maxWidth="400px">
          <Dialog.Title>{editingId !== null ? 'Edit Account' : 'Add Account'}</Dialog.Title>
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
                {editingId !== null ? 'Save' : 'Create'}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <AlertDialog.Root
        open={deleteId !== null}
        onOpenChange={(o) => {
          if (!o) cancelAccountDelete()
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
