import { useEffect, useRef, type JSX } from 'react'
import { Box, Flex, Text, Heading, Badge, Separator } from '@radix-ui/themes'
import { ResponsiveBar } from '@nivo/bar'
import { useBoundStore } from '../../../../store/useBoundStore.ts'
import { useShallow } from 'zustand/react/shallow'
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
  const { billHistory, fetchBillHistory } = useBoundStore(
    useShallow((s) => ({
      billHistory: s.bills.billHistory,
      fetchBillHistory: s.fetchBillHistory,
    })),
  )
  const fetched = useRef(false)

  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true
      fetchBillHistory(bill.id)
    }
  }, [bill.id, fetchBillHistory])

  return (
    <Box>
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between">
          <Box>
            <Heading size="4">{bill.name}</Heading>
            <Text size="1" color="gray">
              {frequencyLabel(bill.frequency)} — Day {bill.due_day}
            </Text>
          </Box>
          <Flex align="center" gap="1">
            {bill.is_variable && (
              <Badge size="1" color="orange">
                Var
              </Badge>
            )}
            <Text size="4" weight="bold">
              ${bill.amount.toFixed(2)}
            </Text>
          </Flex>
        </Flex>

        <Separator size="4" />

        <Flex gap="4" wrap="wrap">
          {bill.category_name && (
            <Box>
              <Text size="1" color="gray">
                Category
              </Text>
              <Text size="2">{bill.category_name}</Text>
            </Box>
          )}
          {bill.merchant_name && (
            <Box>
              <Text size="1" color="gray">
                Merchant
              </Text>
              <Text size="2">{bill.merchant_name}</Text>
            </Box>
          )}
          {bill.account_name && (
            <Box>
              <Text size="1" color="gray">
                Account
              </Text>
              <Text size="2">{bill.account_name}</Text>
            </Box>
          )}
        </Flex>

        <Separator size="4" />

        {bill.is_variable && (
          <Box>
            <Text size="2" weight="medium" mb="2">
              Amount Over Time
            </Text>
            {billHistory.monthly_spending.length > 0 ? (
              <Box className={styles.chart}>
                <ResponsiveBar
                  data={billHistory.monthly_spending}
                  keys={['amount']}
                  indexBy="month"
                  margin={{ top: 10, right: 10, bottom: 40, left: 50 }}
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
              <Text
                color="gray"
                size="1"
                style={{ paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)' }}
              >
                No historical data
              </Text>
            )}
          </Box>
        )}

        <Box>
          <Text size="2" weight="medium" mb="1">
            Payment History
          </Text>
          {billHistory.loading ? (
            <Text color="gray" size="1">
              Loading...
            </Text>
          ) : billHistory.transactions.length > 0 ? (
            <Flex direction="column">
              {billHistory.transactions.map((tx: any) => (
                <Flex key={tx.id} align="center" justify="between" className={styles.txRow}>
                  <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                    <Text size="2">{tx.description}</Text>
                    <Text size="1" color="gray">
                      {tx.date}
                    </Text>
                  </Flex>
                  <Text size="2" weight="bold" style={{ whiteSpace: 'nowrap' }}>
                    ${Number(tx.amount).toFixed(2)}
                  </Text>
                </Flex>
              ))}
            </Flex>
          ) : (
            <Text
              color="gray"
              size="1"
              style={{ paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)' }}
            >
              No payments linked to this bill yet
            </Text>
          )}
        </Box>
      </Flex>
    </Box>
  )
}
