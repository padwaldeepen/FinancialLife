import { useEffect, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Flex, Text, Card } from '@radix-ui/themes'
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
  checking: <Wallet size={22} />,
  savings: <PiggyBank size={22} />,
  credit: <CreditCard size={22} />,
  cash: <Wallet size={22} />,
  investment: <TrendingUp size={22} />,
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
    return (
      <Flex direction="column" gap="4">
        <div className={`${styles.balanceCard} ${styles.skeleton}`} style={{ height: 180 }} />
        <div className="skeleton" style={{ height: 60 }} />
        <div className="skeleton" style={{ height: 60 }} />
      </Flex>
    )
  }

  return (
    <Box className={styles.page}>
      <Flex className={styles.layout}>
        <Box className={styles.leftColumn}>
          {/* Balance Hero */}
          <Card className={styles.balanceCard}>
            <Text className={styles.balanceLabel}>Total Balance</Text>
            <div className={styles.balanceAmount}>${totalBalance.toFixed(2)}</div>
            <Text className={styles.balanceAccounts}>
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            </Text>
          </Card>

          {/* Accounts */}
          <Box>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Accounts</span>
            </div>
            {accounts.length === 0 ? (
              <div className={styles.emptyState}>
                <Text color="gray">No accounts yet</Text>
              </div>
            ) : (
              <Flex direction="column" gap="2" className={styles.accountsList}>
                {accounts.map((account) => (
                  <Card key={account.id} className={styles.accountCard}>
                    <Flex align="center" gap="3">
                      <Box
                        className={styles.accountIcon}
                        style={{
                          background: `${accountColors[account.type] || 'var(--gray-9)'}18`,
                          color: accountColors[account.type] || 'var(--gray-9)',
                        }}
                      >
                        {accountIcons[account.type] || <Wallet size={22} />}
                      </Box>
                      <Box className={styles.accountInfo}>
                        <div className={styles.accountName}>{account.name}</div>
                        <div className={styles.accountType}>{account.type}</div>
                      </Box>
                      <div className={styles.accountBalance}>${account.balance.toFixed(2)}</div>
                    </Flex>
                  </Card>
                ))}
              </Flex>
            )}
          </Box>
        </Box>

        <Box className={styles.rightColumn}>
          {/* Recent Activity */}
          <Card className={styles.contentCard}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Recent Activity</span>
              <button className={styles.seeAll} onClick={() => navigate('/activity')}>
                See all
              </button>
            </div>
            {recentTx.length === 0 ? (
              <div className={styles.emptyState}>
                <Text color="gray" size="2">
                  No transactions yet
                </Text>
              </div>
            ) : (
              <div className={styles.txList}>
                {recentTx.map((t) => (
                  <Flex
                    key={t.id}
                    className={styles.txRow}
                    align="center"
                    justify="between"
                    gap="3"
                  >
                    <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                      <div className={styles.txDescription}>{t.description}</div>
                      <div className={styles.txDate}>{formatDate(t.date)}</div>
                    </Flex>
                    <div
                      className={styles.txAmount}
                      style={{
                        color:
                          t.transaction_type === 'income' ? 'var(--green-11)' : 'var(--gray-12)',
                      }}
                    >
                      {t.transaction_type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                    </div>
                  </Flex>
                ))}
              </div>
            )}
          </Card>

          {/* Upcoming Bills */}
          <Card className={styles.contentCard}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Upcoming Bills</span>
              <button className={styles.seeAll} onClick={() => navigate('/bills')}>
                See all
              </button>
            </div>
            {upcomingBills.length === 0 ? (
              <div className={styles.emptyState}>
                <Text color="gray" size="2">
                  No upcoming bills
                </Text>
              </div>
            ) : (
              <Flex direction="column" gap="2" className={styles.billList}>
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
                    <Text
                      size="2"
                      weight="bold"
                      style={{ color: bill.has_paid ? 'var(--green-11)' : undefined }}
                    >
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
