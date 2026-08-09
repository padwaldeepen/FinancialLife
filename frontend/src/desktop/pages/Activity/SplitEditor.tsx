import { useEffect, useState, type JSX } from 'react'
import { Flex, Text, TextField, Select, Button, IconButton } from '@radix-ui/themes'
import { Plus, Trash2, Split } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import type { FlatCategory } from '../../../store/slices/categoriesSlice.ts'
import styles from './SplitEditor.module.css'
import { toCents } from '../../../shared/utils/money.ts'

interface Draft {
  category_id: string
  amount: string
  note: string
}

const EMPTY: Draft = { category_id: '', amount: '', note: '' }

/** Sum the draft rows in cents so the running total can't drift the way 0.1+0.2 does. */
const sumCents = (rows: Draft[]): number =>
  rows.reduce((acc, r) => acc + toCents(parseFloat(r.amount) || 0), 0)

/**
 * E3 — one receipt, several categories.
 *
 * A supermarket trip is groceries + household + a bottle of wine; forcing it into one
 * category makes every category total approximate. The transaction keeps its single row
 * (Activity still shows one line, and the money is counted once), while these parts
 * carry the category detail.
 *
 * The remainder is shown live and the save button stays disabled until it is exactly
 * zero, because the server rejects anything else — better to make that obvious while
 * typing than to submit and get an error back. Arithmetic here is in integer cents:
 * summing 55.55 + 24.45 + 20.00 as floats gives 100.00000000000001, which would leave
 * the button disabled on a split that is actually correct.
 */
export const SplitEditor = ({
  transactionId,
  total,
  currency,
  categories,
  isSplit,
}: {
  transactionId: number
  total: number
  currency: string
  categories: FlatCategory[]
  isSplit: boolean
}): JSX.Element => {
  const { splits, fetchSplits } = useBoundStore(
    useShallow((s) => ({
      splits: s.transactions.splits[transactionId],
      fetchSplits: s.transactions.fetchSplits,
    })),
  )
  const [open, setOpen] = useState(isSplit)

  useEffect(() => {
    if (isSplit) fetchSplits(transactionId)
  }, [isSplit, transactionId, fetchSplits])

  if (!open) {
    return (
      <Button variant="soft" color="gray" size="2" onClick={() => setOpen(true)}>
        <Split size={14} /> Split across categories
      </Button>
    )
  }
  // Wait for saved parts before mounting the form, then key on them so the form's
  // useState initialisers seed once and cleanly — rather than syncing them in with an
  // effect, which causes the cascading re-render the lint rule warns about. Same
  // pattern the mobile DocumentReview sheet uses.
  if (isSplit && splits === undefined)
    return (
      <Text size="1" color="gray">
        Loading split…
      </Text>
    )

  const seed: Draft[] =
    splits && splits.length > 0
      ? splits.map((p) => ({
          category_id: p.category_id ? String(p.category_id) : '',
          amount: p.amount.toFixed(2),
          note: p.note ?? '',
        }))
      : [EMPTY, EMPTY]

  return (
    <SplitForm
      key={`${transactionId}:${splits?.length ?? 0}`}
      transactionId={transactionId}
      total={total}
      currency={currency}
      categories={categories}
      isSplit={isSplit}
      seed={seed}
      onDone={() => setOpen(false)}
    />
  )
}

const SplitForm = ({
  transactionId,
  total,
  currency,
  categories,
  isSplit,
  seed,
  onDone,
}: {
  transactionId: number
  total: number
  currency: string
  categories: FlatCategory[]
  isSplit: boolean
  seed: Draft[]
  onDone: () => void
}): JSX.Element => {
  const { saveSplits, clearSplits } = useBoundStore(
    useShallow((s) => ({
      saveSplits: s.transactions.saveSplits,
      clearSplits: s.transactions.clearSplits,
    })),
  )
  const [rows, setRows] = useState<Draft[]>(seed)
  const [saving, setSaving] = useState(false)

  const totalCents = toCents(total)
  const remainderCents = totalCents - sumCents(rows)
  const balanced = remainderCents === 0
  const usable = rows.filter((r) => r.amount.trim() !== '')

  const setRow = (i: number, patch: Partial<Draft>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  return (
    <Flex direction="column" gap="2" className={styles.editor}>
      <Text size="1" color="gray">
        Parts must add up to {formatCurrency(total, currency)}
      </Text>

      {rows.map((row, i) => (
        <Flex key={i} gap="2" align="center">
          <Select.Root value={row.category_id} onValueChange={(v) => setRow(i, { category_id: v })}>
            <Select.Trigger placeholder="Category" className={styles.cat} />
            <Select.Content>
              {categories.map((c) => (
                <Select.Item key={c.id} value={String(c.id)}>
                  {c.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          <TextField.Root
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            aria-label={`Part ${i + 1} amount`}
            value={row.amount}
            onChange={(e) => setRow(i, { amount: e.target.value })}
            className={styles.amount}
          />
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            aria-label={`Remove part ${i + 1}`}
            disabled={rows.length <= 2}
            onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
          >
            <Trash2 size={14} />
          </IconButton>
        </Flex>
      ))}

      <Flex justify="between" align="center">
        <Button variant="ghost" size="1" onClick={() => setRows([...rows, EMPTY])}>
          <Plus size={14} /> Add part
        </Button>
        <Text size="1" className={balanced ? styles.balanced : styles.unbalanced}>
          {balanced
            ? 'Adds up exactly'
            : `${formatCurrency(Math.abs(remainderCents) / 100, currency)} ${
                remainderCents > 0 ? 'left to assign' : 'over'
              }`}
        </Text>
      </Flex>

      <Flex gap="2" justify="end">
        {isSplit && (
          <Button
            variant="soft"
            color="gray"
            size="2"
            onClick={() => {
              clearSplits(transactionId)
              onDone()
            }}
          >
            Remove split
          </Button>
        )}
        <Button
          size="2"
          disabled={!balanced || usable.length < 2 || saving}
          loading={saving}
          onClick={async () => {
            setSaving(true)
            await saveSplits(
              transactionId,
              usable.map((r) => ({
                category_id: r.category_id ? Number(r.category_id) : null,
                amount: parseFloat(r.amount),
                note: r.note || null,
              })),
            )
            setSaving(false)
          }}
        >
          Save split
        </Button>
      </Flex>
    </Flex>
  )
}
