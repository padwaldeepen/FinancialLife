import { useEffect, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Flex, Text, Card } from '@radix-ui/themes'
import { Wallet, PiggyBank, CreditCard, TrendingUp } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency, formatDate } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
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
  const currency = useActiveCurrency()
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

  if (loading) {
    return (
      <Flex direction="column" gap="4">
        <div className={`${styles.balanceCard} ${styles.skeleton} ${styles.chartArea}`} />
        <div className={`skeleton ${styles.miniChart}`} />
        <div className={`skeleton ${styles.miniChart}`} />
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
            <div className={styles.balanceAmount}>{formatCurrency(totalBalance, currency)}</div>
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
                        style={
                          {
                            '--account-bg': `${accountColors[account.type] || 'var(--gray-9)'}18`,
                            '--account-color': accountColors[account.type] || 'var(--gray-9)',
                          } as React.CSSProperties
                        }
                      >
                        {accountIcons[account.type] || <Wallet size={22} />}
                      </Box>
                      <Box className={styles.accountInfo}>
                        <div className={styles.accountName}>{account.name}</div>
                        <div className={styles.accountType}>{account.type}</div>
                      </Box>
                      <div className={styles.accountBalance}>
                        {formatCurrency(account.balance, currency)}
                      </div>
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
                    <Flex direction="column" gap="1" className={styles.flex1}>
                      <div className={styles.txDescription}>{t.description}</div>
                      <div className={styles.txDate}>{formatDate(t.date)}</div>
                    </Flex>
                    <div
                      className={styles.txAmount}
                      style={
                        {
                          '--tx-color':
                            t.transaction_type === 'income' ? 'var(--green-11)' : 'var(--gray-12)',
                        } as React.CSSProperties
                      }
                    >
                      {t.transaction_type === 'income' ? '+' : '-'}
                      {formatCurrency(t.amount, currency)}
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
                    <Flex direction="column" gap="1" className={styles.flex1}>
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
                      className={styles.billAmount}
                      style={
                        {
                          '--bill-color': bill.has_paid ? 'var(--green-11)' : undefined,
                        } as React.CSSProperties
                      }
                    >
                      {bill.has_paid ? '✓ ' : ''}
                      {formatCurrency(bill.amount, currency)}
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
