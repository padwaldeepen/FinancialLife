import { useEffect, useRef, useState, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  Heading,
  Badge,
  Separator,
  Tabs,
  Button,
  Dialog,
  TextField,
} from '@radix-ui/themes'
import { Link2, Unlink } from 'lucide-react'
import { ResponsiveBar } from '@nivo/bar'
import toast from 'react-hot-toast'
import { useBoundStore } from '../../../../store/useBoundStore.ts'
import { useShallow } from 'zustand/react/shallow'
import { formatCurrency } from '../../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../../shared/hooks/useActiveCurrency.ts'
import styles from './BillDetail.module.css'

interface BillDetailProps {
  bill: {
    id: number
    name: string
    amount: number
    amount_estimated: number | null
    frequency: string
    due_day: number
    category_name: string | null
    merchant_name: string | null
    account_name: string | null
    is_variable: boolean
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

export const BillDetail = ({ bill }: BillDetailProps): JSX.Element => {
  const currency = useActiveCurrency()
  const {
    billHistory,
    fetchBillHistory,
    linkTransactionToBill,
    unlinkTransactionFromBill,
    fetchTransactions,
  } = useBoundStore(
    useShallow((s) => ({
      billHistory: s.bills.billHistory,
      fetchBillHistory: s.fetchBillHistory,
      linkTransactionToBill: s.linkTransactionToBill,
      unlinkTransactionFromBill: s.unlinkTransactionFromBill,
      fetchTransactions: s.fetchTransactions,
    })),
  )
  const transactions = useBoundStore((s) => s.transactions.items)
  const fetched = useRef(false)
  const txFetchedForLink = useRef(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')

  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true
      fetchBillHistory(bill.id)
    }
  }, [bill.id, fetchBillHistory])

  // The link dialog reads from the shared transactions list, but no page on the
  // Bills route ever populates it — a user landing here without having visited
  // Activity/Home first would see "no transactions found" even when matches exist.
  useEffect(() => {
    if (linkOpen && !txFetchedForLink.current) {
      txFetchedForLink.current = true
      fetchTransactions({ reset: true })
    }
  }, [linkOpen, fetchTransactions])

  const handleLink = async (transactionId: number) => {
    try {
      await linkTransactionToBill(bill.id, transactionId)
      toast.success('Transaction linked to bill')
      setLinkOpen(false)
      fetchBillHistory(bill.id)
    } catch {
      toast.error('Failed to link transaction')
    }
  }

  const handleUnlink = async (transactionId: number) => {
    try {
      await unlinkTransactionFromBill(bill.id, transactionId)
      toast.success('Transaction unlinked')
      fetchBillHistory(bill.id)
    } catch {
      toast.error('Failed to unlink transaction')
    }
  }

  const availableTx = (transactions as any[]).filter(
    (t: any) =>
      !t.bill_id &&
      (t.description.toLowerCase().includes(linkSearch.toLowerCase()) ||
        String(t.amount).includes(linkSearch)),
  )

  return (
    <Box>
      <Flex direction="column" gap="4">
        <Flex align="center" justify="between">
          <Box>
            <Heading size="5">{bill.name}</Heading>
            <Text size="2" color="gray">
              {frequencyLabel(bill.frequency)} — Due day {bill.due_day}
            </Text>
          </Box>
          <Flex align="center" gap="2">
            {bill.is_variable && <Badge color="orange">Variable</Badge>}
            <Text size="5" weight="bold">
              {formatCurrency(bill.amount, currency)}
              {bill.is_variable && bill.amount_estimated && (
                <Text size="1" color="gray">
                  {' '}
                  (est. {formatCurrency(bill.amount_estimated, currency)})
                </Text>
              )}
            </Text>
          </Flex>
        </Flex>

        <Separator size="4" />

        <Flex gap="6">
          {bill.category_name && (
            <Box>
              <Text size="1" color="gray">
                Category
              </Text>
              <Text size="2" weight="medium">
                {bill.category_name}
              </Text>
            </Box>
          )}
          {bill.merchant_name && (
            <Box>
              <Text size="1" color="gray">
                Merchant
              </Text>
              <Text size="2" weight="medium">
                {bill.merchant_name}
              </Text>
            </Box>
          )}
          {bill.account_name && (
            <Box>
              <Text size="1" color="gray">
                Account
              </Text>
              <Text size="2" weight="medium">
                {bill.account_name}
              </Text>
            </Box>
          )}
        </Flex>

        <Separator size="4" />

        <Tabs.Root defaultValue="history">
          <Tabs.List>
            {bill.is_variable && <Tabs.Trigger value="chart">Amount Over Time</Tabs.Trigger>}
            <Tabs.Trigger value="history">Payment History</Tabs.Trigger>
          </Tabs.List>

          {bill.is_variable && (
            <Tabs.Content value="chart" className={styles.sectionPadding}>
              {billHistory.monthly_spending.length > 0 ? (
                <Box className={styles.chart}>
                  <ResponsiveBar
                    data={billHistory.monthly_spending}
                    keys={['amount']}
                    indexBy="month"
                    margin={{ top: 10, right: 20, bottom: 40, left: 60 }}
                    padding={0.3}
                    colors={{ scheme: 'oranges' }}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: -45,
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      format: (v: number) => `$${v}`,
                    }}
                    enableLabel={false}
                  />
                </Box>
              ) : (
                <Text color="gray" className={styles.sectionPadY}>
                  No historical data for this bill
                </Text>
              )}
            </Tabs.Content>
          )}

          <Tabs.Content value="history" className={styles.sectionPadding}>
            {billHistory.loading ? (
              <Flex direction="column" gap="2" p="3">
                <div
                  className="skeleton"
                  style={{ height: 16, width: '90%', borderRadius: 'var(--radius-2)' }}
                />
                <div
                  className="skeleton"
                  style={{ height: 16, width: '65%', borderRadius: 'var(--radius-2)' }}
                />
                <div
                  className="skeleton"
                  style={{ height: 16, width: '80%', borderRadius: 'var(--radius-2)' }}
                />
              </Flex>
            ) : billHistory.transactions.length > 0 ? (
              <Flex direction="column" gap="1">
                {billHistory.transactions.map((tx: any) => (
                  <Flex key={tx.id} align="center" justify="between" className={styles.txRow}>
                    <Flex direction="column" gap="1">
                      <Text size="2">{tx.description}</Text>
                      <Text size="1" color="gray">
                        {tx.date} {tx.category_name ? `— ${tx.category_name}` : ''}
                      </Text>
                    </Flex>
                    <Flex align="center" gap="2">
                      <Text size="2" weight="bold">
                        {formatCurrency(Number(tx.amount), currency)}
                      </Text>
                      <Button
                        size="1"
                        variant="ghost"
                        color="red"
                        onClick={() => handleUnlink(tx.id)}
                        aria-label="Unlink"
                      >
                        <Unlink size={12} />
                      </Button>
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            ) : (
              <Text color="gray" className={styles.sectionPadY}>
                No payments linked to this bill yet
              </Text>
            )}
            <Button size="1" variant="soft" mt="2" onClick={() => setLinkOpen(true)}>
              <Link2 size={12} /> Link Transaction
            </Button>
          </Tabs.Content>
        </Tabs.Root>

        <Dialog.Root open={linkOpen} onOpenChange={setLinkOpen}>
          <Dialog.Content maxWidth="420px">
            <Dialog.Title>Link Transaction</Dialog.Title>
            <TextField.Root
              placeholder="Search transactions..."
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              mt="3"
              mb="3"
            />
            <Flex direction="column" gap="1" className={styles.scrollArea}>
              {availableTx.length === 0 ? (
                <Text size="2" color="gray">
                  No unlinked transactions found
                </Text>
              ) : (
                availableTx.slice(0, 20).map((tx: any) => (
                  <Flex
                    key={tx.id}
                    align="center"
                    justify="between"
                    className={`${styles.txRow} ${styles.clickable}`}
                    onClick={() => handleLink(tx.id)}
                  >
                    <Flex direction="column" gap="1">
                      <Text size="2">{tx.description}</Text>
                      <Text size="1" color="gray">
                        {tx.date}
                      </Text>
                    </Flex>
                    <Text size="2" weight="bold">
                      {formatCurrency(tx.amount, currency)}
                    </Text>
                  </Flex>
                ))
              )}
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
    </Box>
  )
}
