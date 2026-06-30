import { useEffect, useRef, type JSX } from 'react'
import { Box, Flex, Text, Heading, Badge, Separator, Tabs } from '@radix-ui/themes'
import { ResponsiveBar } from '@nivo/bar'
import { useBoundStore } from '../../../../store/useBoundStore.ts'
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
  const { billHistory, fetchBillHistory } = useBoundStore((s) => ({
    billHistory: s.bills.billHistory,
    fetchBillHistory: s.fetchBillHistory,
  }))
  const fetched = useRef(false)

  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true
      fetchBillHistory(bill.id)
    }
  }, [bill.id, fetchBillHistory])

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
              ${bill.amount.toFixed(2)}
              {bill.is_variable && bill.amount_estimated && (
                <Text size="1" color="gray">
                  {' '}
                  (est. ${bill.amount_estimated.toFixed(2)})
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
            <Tabs.Content value="chart" pt="3">
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
                <Text color="gray" py="4">
                  No historical data for this bill
                </Text>
              )}
            </Tabs.Content>
          )}

          <Tabs.Content value="history" pt="3">
            {billHistory.loading ? (
              <Text color="gray">Loading...</Text>
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
                    <Text size="2" weight="bold">
                      ${Number(tx.amount).toFixed(2)}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            ) : (
              <Text color="gray" py="4">
                No payments linked to this bill yet
              </Text>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </Flex>
    </Box>
  )
}
