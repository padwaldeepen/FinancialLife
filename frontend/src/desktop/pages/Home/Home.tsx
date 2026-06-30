import { useEffect, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Flex, Heading, Text, Card } from '@radix-ui/themes'
import { Wallet, PiggyBank, CreditCard, TrendingUp } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Home.module.css'

interface Transaction {
  id: number
  amount: number
  description: string
  transaction_type: string
  category_name: string | null
  category_color: string | null
  date: string
}

interface UpcomingBill {
  id: number
  name: string
  amount: number
  frequency: string
  next_due: string
  days_until: number
  is_variable: boolean
  has_paid: boolean
  category_name: string | null
}

const accountIcons: Record<string, JSX.Element> = {
  checking: <Wallet size={20} />,
  savings: <PiggyBank size={20} />,
  credit: <CreditCard size={20} />,
  cash: <Wallet size={20} />,
  investment: <TrendingUp size={20} />,
}

const accountColors: Record<string, string> = {
  checking: 'var(--accent-9)',
  savings: 'var(--green-9)',
  credit: 'var(--red-9)',
  cash: 'var(--orange-9)',
  investment: 'var(--purple-9)',
}

export const Home = (): JSX.Element => {
  const navigate = useNavigate()
  const {
    accounts,
    accountsLoading,
    fetchAccounts,
    transactions,
    txLoading,
    fetchTransactions,
    upcomingBills,
    fetchUpcomingBills,
  } = useBoundStore(
    useShallow((s) => ({
      accounts: s.accounts.items,
      accountsLoading: s.accounts.loading,
      fetchAccounts: s.fetchAccounts,
      transactions: s.transactions.items,
      txLoading: s.transactions.loading,
      fetchTransactions: s.fetchTransactions,
      upcomingBills: s.bills.upcoming as UpcomingBill[],
      fetchUpcomingBills: s.fetchUpcomingBills,
    })),
  )

  useEffect(() => {
    fetchAccounts()
    fetchTransactions({ reset: true })
    fetchUpcomingBills()
  }, [fetchAccounts, fetchTransactions, fetchUpcomingBills])

  const loading = accountsLoading && txLoading

  const recentTx = transactions.slice(0, 5) as Transaction[]
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return <Text color="gray">Loading...</Text>
  }

  return (
    <Box className={styles.page}>
      <Flex className={styles.layout}>
        <Box className={styles.leftColumn}>
          <Card className={styles.balanceCard}>
            <Text size="2" color="gray">
              Total Balance
            </Text>
            <Heading size="8" className={styles.balanceAmount}>
              ${totalBalance.toFixed(2)}
            </Heading>
            <Text size="1" color="gray">
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            </Text>
          </Card>

          <Heading size="4" mt="5" mb="3">
            Accounts
          </Heading>
          {accounts.length === 0 ? (
            <Text color="gray">No accounts yet</Text>
          ) : (
            <Flex direction="column" gap="2">
              {accounts.map((account) => (
                <Card key={account.id} className={styles.accountCard}>
                  <Flex align="center" gap="3">
                    <Box
                      className={styles.accountIcon}
                      style={{ color: accountColors[account.type] || 'var(--gray-9)' }}
                    >
                      {accountIcons[account.type] || <Wallet size={20} />}
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <Text size="2" weight="bold">
                        {account.name}
                      </Text>
                      <Text size="1" color="gray" style={{ textTransform: 'capitalize' }}>
                        {account.type}
                      </Text>
                    </Box>
                    <Text size="4" weight="bold">
                      ${account.balance.toFixed(2)}
                    </Text>
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}
        </Box>

        <Box className={styles.rightColumn}>
          <Card>
            <Flex align="center" justify="between" mb="3">
              <Heading size="3">Recent Activity</Heading>
              <Text
                size="2"
                color="gray"
                className={styles.seeAll}
                onClick={() => navigate('/activity')}
              >
                See all
              </Text>
            </Flex>
            {recentTx.length === 0 ? (
              <Text color="gray">No transactions yet</Text>
            ) : (
              <Flex direction="column">
                {recentTx.map((t) => (
                  <Flex
                    key={t.id}
                    className={styles.transactionRow}
                    align="center"
                    justify="between"
                  >
                    <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                      <Text size="2" weight="medium" className={styles.description}>
                        {t.description}
                      </Text>
                      <Text size="1" color="gray">
                        {formatDate(t.date)}
                      </Text>
                    </Flex>
                    <Text
                      size="3"
                      weight="bold"
                      color={t.transaction_type === 'income' ? 'green' : 'red'}
                    >
                      {t.transaction_type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            )}
          </Card>

          <Card mt="4">
            <Heading size="3" mb="3">
              Upcoming Bills
            </Heading>
            {upcomingBills.length === 0 ? (
              <Text color="gray" size="2">
                No upcoming bills
              </Text>
            ) : (
              <Flex direction="column" gap="2">
                {upcomingBills.slice(0, 5).map((bill) => (
                  <Flex key={bill.id} align="center" justify="between" className={styles.billRow}>
                    <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                      <Text size="2" weight="medium">
                        {bill.name}
                      </Text>
                      <Text size="1" color="gray">
                        {bill.has_paid
                          ? 'Paid'
                          : bill.days_until === 0
                            ? 'Due today'
                            : `${bill.days_until} day${bill.days_until === 1 ? '' : 's'}`}
                        {bill.is_variable && ' (estimated)'}
                      </Text>
                    </Flex>
                    <Text size="2" weight="bold" color={bill.has_paid ? 'green' : undefined}>
                      {bill.has_paid ? '✓ ' : ''}${bill.amount.toFixed(2)}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            )}
          </Card>
        </Box>
      </Flex>
    </Box>
  )
}
