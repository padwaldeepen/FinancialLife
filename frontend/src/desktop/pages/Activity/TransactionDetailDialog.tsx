import { useState, type JSX } from 'react'
import {
  Flex,
  Text,
  TextField,
  Select,
  Badge,
  IconButton,
  Dialog,
  Button,
  Checkbox,
} from '@radix-ui/themes'
import { Search, Trash2, Pencil, X, Link2, Unlink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { Transaction } from '../../../store/slices/transactionsSlice.ts'
import { formatCurrency, getAmountColor } from '../../../shared/utils/format.ts'
import styles from './Activity.module.css'

interface FlatCategory {
  id: number
  name: string
  color: string
  depth: number
}
interface Merchant {
  id: number
  name: string
}
interface Account {
  id: number
  name: string
}
interface Bill {
  id: number
  name: string
  amount: number
}

interface EditForm {
  amount: number
  description: string
  transaction_type: string
  category_id: number | null
  merchant_id: number | null
  account_id: number
  date: string
  is_pending: boolean
  is_recurring: boolean
}

interface Props {
  transaction: Transaction
  currency: string
  categories: FlatCategory[]
  merchants: Merchant[]
  accounts: Account[]
  bills: Bill[]
  onClose: () => void
  onDelete: (id: number) => void
  onSaveNotes: (id: number, notes: string) => void
  onSaveEdit: (id: number, data: EditForm) => Promise<boolean>
  onLinkBill: (billId: number) => Promise<void>
  onUnlinkBill: () => Promise<void>
}

export const TransactionDetailDialog = ({
  transaction,
  currency,
  categories,
  merchants,
  accounts,
  bills,
  onClose,
  onDelete,
  onSaveNotes,
  onSaveEdit,
  onLinkBill,
  onUnlinkBill,
}: Props): JSX.Element => {
  const [editing, setEditing] = useState(false)
  const [editNotes, setEditNotes] = useState(transaction.notes || '')
  const [linkBillOpen, setLinkBillOpen] = useState(false)
  const [linkBillSearch, setLinkBillSearch] = useState('')
  const [editForm, setEditForm] = useState<EditForm>({
    amount: transaction.amount,
    description: transaction.description,
    transaction_type: transaction.transaction_type,
    category_id: transaction.category_id,
    merchant_id: transaction.merchant_id,
    account_id: transaction.account_id,
    date: transaction.date,
    is_pending: transaction.is_pending,
    is_recurring: transaction.is_recurring,
  })

  const linkedBill = transaction.bill_id ? bills.find((b) => b.id === transaction.bill_id) : null
  const availableBills = bills.filter((b) =>
    b.name.toLowerCase().includes(linkBillSearch.toLowerCase()),
  )

  const handleSave = async () => {
    const ok = await onSaveEdit(transaction.id, editForm)
    if (ok) setEditing(false)
  }

  return (
    <>
      <Dialog.Content className={styles.dialogDetail}>
        <Flex justify="between" align="center" className={styles.detailHeader}>
          <Dialog.Title className={styles.dialogTitle}>
            {editing ? 'Edit Transaction' : transaction.description}
          </Dialog.Title>
          <IconButton variant="ghost" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </Flex>

        {editing ? (
          <Flex direction="column" gap="3">
            <Flex direction="column" gap="1">
              <Text as="div" className={styles.detailLabel}>
                Description
              </Text>
              <TextField.Root
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </Flex>

            <Flex direction="column" gap="1">
              <Text as="div" className={styles.detailLabel}>
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
              <Text as="div" className={styles.detailLabel}>
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
              <Text as="div" className={styles.detailLabel}>
                Date
              </Text>
              <TextField.Root
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </Flex>

            <Flex direction="column" gap="1">
              <Text as="div" className={styles.detailLabel}>
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
              <Text as="div" className={styles.detailLabel}>
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
              <Text as="div" className={styles.detailLabel}>
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

            <Flex gap="4" align="center">
              <Text as="label" className={styles.checkboxLabel}>
                <Checkbox
                  checked={editForm.is_pending}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_pending: v === true })}
                />
                <Text size="2">Pending</Text>
              </Text>
              <Text as="label" className={styles.checkboxLabel}>
                <Checkbox
                  checked={editForm.is_recurring}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_recurring: v === true })}
                />
                <Text size="2">Recurring</Text>
              </Text>
            </Flex>

            <Flex gap="2" justify="end">
              <Button variant="soft" color="gray" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button variant="solid" onClick={handleSave}>
                Save changes
              </Button>
            </Flex>
          </Flex>
        ) : (
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center">
              <Text
                as="div"
                className={styles.detailAmount}
                style={{ color: getAmountColor(transaction.transaction_type) }}
              >
                {transaction.transaction_type === 'income' ? '+' : '-'}
                {formatCurrency(transaction.amount, currency)}
              </Text>
              <Badge color={transaction.transaction_type === 'income' ? 'green' : 'red'}>
                {transaction.transaction_type}
              </Badge>
            </Flex>

            <Flex direction="column" gap="1" className={styles.detailSection}>
              <Text as="div" className={styles.detailLabel}>
                Date
              </Text>
              <Text as="div" className={styles.detailValue}>
                {format(parseISO(transaction.date), 'EEEE, MMMM d, yyyy')}
              </Text>
            </Flex>

            {transaction.merchant_name && (
              <Flex direction="column" gap="1" className={styles.detailSection}>
                <Text as="div" className={styles.detailLabel}>
                  Merchant
                </Text>
                <Text as="div" className={styles.detailValue}>
                  {transaction.merchant_name}
                </Text>
              </Flex>
            )}

            {transaction.category_name && (
              <Flex direction="column" gap="1" className={styles.detailSection}>
                <Text as="div" className={styles.detailLabel}>
                  Category
                </Text>
                <Badge color={(transaction.category_color as 'gray') || 'gray'}>
                  {transaction.category_name}
                </Badge>
              </Flex>
            )}

            {transaction.account_name && (
              <Flex direction="column" gap="1" className={styles.detailSection}>
                <Text as="div" className={styles.detailLabel}>
                  Account
                </Text>
                <Text as="div" className={styles.detailValue}>
                  {transaction.account_name}
                </Text>
              </Flex>
            )}

            <Flex direction="column" gap="1" className={styles.detailSection}>
              <Text as="div" className={styles.detailLabel}>
                Bill
              </Text>
              {linkedBill ? (
                <Flex align="center" gap="2">
                  <Text as="div" className={styles.detailValue}>
                    {linkedBill.name}
                  </Text>
                  <Button size="1" variant="ghost" color="red" onClick={onUnlinkBill}>
                    <Unlink size={12} />
                  </Button>
                </Flex>
              ) : (
                <Button size="1" variant="soft" onClick={() => setLinkBillOpen(true)}>
                  <Link2 size={12} /> Link to bill
                </Button>
              )}
            </Flex>

            <Flex gap="2">
              {transaction.is_pending && <Badge variant="soft">Pending</Badge>}
              {transaction.is_recurring && (
                <Badge color="gray" variant="soft">
                  Recurring
                </Badge>
              )}
            </Flex>

            <Flex direction="column" gap="1">
              <Text as="div" className={styles.detailLabel}>
                Notes
              </Text>
              <TextField.Root
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes..."
              />
            </Flex>

            <Flex gap="2" justify="end">
              <Button variant="soft" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Edit
              </Button>
              <Button
                variant="soft"
                color="green"
                onClick={() => onSaveNotes(transaction.id, editNotes)}
              >
                Save notes
              </Button>
              <Button
                variant="soft"
                color="red"
                onClick={() => {
                  onDelete(transaction.id)
                  onClose()
                }}
              >
                <Trash2 size={14} /> Delete
              </Button>
            </Flex>
          </Flex>
        )}
      </Dialog.Content>

      <Dialog.Root open={linkBillOpen} onOpenChange={setLinkBillOpen}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>Link to Bill</Dialog.Title>
          <TextField.Root
            placeholder="Search bills..."
            value={linkBillSearch}
            onChange={(e) => setLinkBillSearch(e.target.value)}
            mt="3"
            mb="3"
          >
            <TextField.Slot side="left">
              <Search size={14} />
            </TextField.Slot>
          </TextField.Root>
          <Flex direction="column" gap="1" className={styles.scrollableList}>
            {availableBills.length === 0 ? (
              <Text size="2" color="gray">
                No bills found
              </Text>
            ) : (
              availableBills.map((bill) => (
                <Flex
                  key={bill.id}
                  align="center"
                  justify="between"
                  className={`${styles.row} ${styles.billItem}`}
                  onClick={async () => {
                    await onLinkBill(bill.id)
                    setLinkBillOpen(false)
                  }}
                >
                  <Text size="2" weight="medium">
                    {bill.name}
                  </Text>
                  <Text size="2" color="gray">
                    {formatCurrency(bill.amount, currency)}
                  </Text>
                </Flex>
              ))
            )}
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
