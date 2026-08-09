import { useState, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  Button,
  Dialog,
  TextField,
  Select,
  Checkbox,
  IconButton,
  VisuallyHidden,
} from '@radix-ui/themes'
import { X } from 'lucide-react'
import type { Bill } from '../../../store/slices/billsSlice.ts'
import styles from './Recurring.module.css'

interface Account {
  id: number
  name: string
}

interface BillFormValues {
  name: string
  amount: string
  frequency: string
  due_day: string
  account_id: string
  is_variable: boolean
}

const emptyForm: BillFormValues = {
  name: '',
  amount: '',
  frequency: 'monthly',
  due_day: '1',
  account_id: '',
  is_variable: false,
}

// weekly/biweekly bills store due_day as a weekday index (0=Monday..6=Sunday, matching
// Python's date.weekday()); monthly/quarterly/yearly store it as a day-of-month (1-31).
// Same field, different domain depending on frequency — the UI has to switch accordingly.
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const isWeekly = (frequency: string) => frequency === 'weekly' || frequency === 'biweekly'

const toFormValues = (bill: Bill): BillFormValues => ({
  name: bill.name,
  amount: String(bill.amount),
  frequency: bill.frequency,
  due_day: String(bill.due_day),
  account_id: String(bill.account_id),
  is_variable: bill.is_variable,
})

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  bill: Bill | null
  accounts: Account[]
  saving: boolean
  onSubmit: (values: {
    name: string
    amount: number
    frequency: string
    due_day: number
    account_id: number
    is_variable: boolean
  }) => void
}

// One dialog for both create and edit — the original had two ~90-line dialogs with a
// byte-identical field set (rules/dry.md), diverging only in which action they called
// on submit.
export const BillFormDialog = ({
  open,
  onOpenChange,
  bill,
  accounts,
  saving,
  onSubmit,
}: Props): JSX.Element => {
  const [form, setForm] = useState<BillFormValues>(emptyForm)
  // Adjusting state on a prop change during render (React-recommended pattern) instead
  // of a useEffect — resets the form the moment `open` or `bill` changes, with no
  // cascading extra render.
  const resetKey = `${open}:${bill?.id ?? 'new'}`
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey)
    if (open) setForm(bill ? toFormValues(bill) : emptyForm)
  }

  const valid = form.name.trim() && form.amount && form.account_id && form.due_day
  const isWeeklyFrequency = isWeekly(form.frequency)

  const handleFrequencyChange = (frequency: string) => {
    // Crossing the weekly<->monthly domain boundary makes the previous due_day value
    // meaningless (a weekday index isn't a valid day-of-month and vice versa) — reset
    // it to that domain's default instead of silently carrying over a bad number.
    const crossedDomain = isWeekly(frequency) !== isWeekly(form.frequency)
    setForm({
      ...form,
      frequency,
      due_day: crossedDomain ? (isWeekly(frequency) ? '0' : '1') : form.due_day,
    })
  }

  const handleSubmit = () => {
    if (!valid) return
    onSubmit({
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      due_day: parseInt(form.due_day, 10),
      account_id: parseInt(form.account_id, 10),
      is_variable: form.is_variable,
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="400px">
        {/* This dialog had NO way out except Escape — same defect as the Import dialog
            (Y6). Uses the shared header pattern (title + ghost X) that
            AddTransactionModal and the upload dialog already use, so dismissal is
            consistent everywhere instead of per-dialog guesswork. */}
        <Flex align="center" justify="between" mb="2">
          <Dialog.Title mb="0">{bill ? 'Edit Bill' : 'Create Bill'}</Dialog.Title>
          <Dialog.Close>
            <IconButton variant="ghost" size="2" color="gray" aria-label="Close">
              <X size={18} />
            </IconButton>
          </Dialog.Close>
        </Flex>
        <VisuallyHidden>
          <Dialog.Description>
            Set the amount, due date and how often this bill repeats
          </Dialog.Description>
        </VisuallyHidden>
        <Flex direction="column" gap="3" mt="3">
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium">
              Name
            </Text>
            <TextField.Root
              placeholder="e.g. Rent"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium">
              Amount
            </Text>
            <TextField.Root
              type="number"
              placeholder="1200"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            >
              <TextField.Slot side="left">$</TextField.Slot>
            </TextField.Root>
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium">
              Account
            </Text>
            <Select.Root
              value={form.account_id}
              onValueChange={(v) => setForm({ ...form, account_id: v })}
            >
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
                <Select.Root value={form.frequency} onValueChange={handleFrequencyChange}>
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
                  {isWeeklyFrequency ? 'Due Day' : 'Due Day of Month'}
                </Text>
                {isWeeklyFrequency ? (
                  <Select.Root
                    value={form.due_day}
                    onValueChange={(v) => setForm({ ...form, due_day: v })}
                  >
                    <Select.Trigger placeholder="Day of week" />
                    <Select.Content>
                      {WEEKDAY_NAMES.map((label, idx) => (
                        <Select.Item key={idx} value={String(idx)}>
                          {label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                ) : (
                  <TextField.Root
                    type="number"
                    min={1}
                    max={31}
                    placeholder="1"
                    value={form.due_day}
                    onChange={(e) => setForm({ ...form, due_day: e.target.value })}
                  />
                )}
              </Flex>
            </Box>
          </Flex>
          <Text as="label" size="2">
            <Flex align="center" gap="2">
              <Checkbox
                checked={form.is_variable}
                onCheckedChange={(v) => setForm({ ...form, is_variable: v === true })}
              />
              <Text>Variable amount (estimated)</Text>
            </Flex>
          </Text>
          <Flex justify="end" gap="2" mt="2">
            <Dialog.Close>
              <Button variant="soft" color="gray" size="3">
                Cancel
              </Button>
            </Dialog.Close>
            <Button onClick={handleSubmit} loading={saving} size="3" disabled={!valid}>
              {bill ? 'Save Changes' : 'Create Bill'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
