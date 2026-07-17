import { useState, useEffect, useRef, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Flex, Heading, Text, Card } from '@radix-ui/themes'
import { Wallet, PiggyBank, CreditCard, TrendingUp, RefreshCw } from 'lucide-react'
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
  category_name: string | null
  has_paid: boolean
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

const PULL_THRESHOLD = 80

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
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  useEffect(() => {
    fetchAccounts()
    fetchTransactions({ reset: true })
    fetchUpcomingBills()
  }, [fetchAccounts, fetchTransactions, fetchUpcomingBills])

  const loading = accountsLoading && txLoading

  const fetchData = async () => {
    setRefreshing(true)
    await Promise.all([fetchAccounts(), fetchTransactions({ reset: true })])
    setRefreshing(false)
  }

  const recentTx = transactions.slice(0, 5) as Transaction[]
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return
    touchStartY.current = e.touches[0]!.clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const diff = e.touches[0]!.clientY - touchStartY.current
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, PULL_THRESHOLD * 1.5))
    }
  }

  const handleTouchEnd = () => {
    if (!isPulling.current) return
    isPulling.current = false
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setPullDistance(PULL_THRESHOLD)
      fetchData()
    }
    setPullDistance(0)
  }

  if (loading) {
    return (
      <Flex direction="column" gap="3" p="3">
        <div
          className="skeleton"
          style={{ height: 20, width: '60%', borderRadius: 'var(--radius-2)' }}
        />
        <div
          className="skeleton"
          style={{ height: 80, width: '100%', borderRadius: 'var(--radius-2)' }}
        />
        <div
          className="skeleton"
          style={{ height: 16, width: '100%', borderRadius: 'var(--radius-2)' }}
        />
        <div
          className="skeleton"
          style={{ height: 16, width: '70%', borderRadius: 'var(--radius-2)' }}
        />
        <div
          className="skeleton"
          style={{ height: 16, width: '45%', borderRadius: 'var(--radius-2)' }}
        />
      </Flex>
    )
  }

  return (
    <Box
      className={styles.page}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Box
        className={styles.pullIndicator}
        style={
          {
            '--pull-height': `${pullDistance}px`,
            '--pull-opacity': Math.min(pullDistance / PULL_THRESHOLD, 1),
          } as React.CSSProperties
        }
      >
        <RefreshCw
          size={20}
          className={
            refreshing ? styles.spinning : pullDistance >= PULL_THRESHOLD ? styles.ready : ''
          }
        />
      </Box>

      <Flex direction="column" gap="4">
        <Card className={styles.balanceCard}>
          <Text size="2" color="gray">
            Total Balance
          </Text>
          <Heading size="7" className={styles.balanceAmount}>
            {formatCurrency(totalBalance, currency)}
          </Heading>
          <Text size="1" color="gray">
            {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
          </Text>
        </Card>

        <Heading size="3">Accounts</Heading>
        {accounts.length === 0 ? (
          <Text color="gray">No accounts yet</Text>
        ) : (
          <Flex direction="column" gap="2">
            {accounts.map((account) => (
              <Card key={account.id} className={styles.accountCard}>
                <Flex align="center" gap="3">
                  <Box
                    className={styles.accountIcon}
                    style={
                      {
                        '--account-color': accountColors[account.type] || 'var(--gray-9)',
                      } as React.CSSProperties
                    }
                  >
                    {accountIcons[account.type] || <Wallet size={20} />}
                  </Box>
                  <Box className={styles.flex1}>
                    <Text size="2" weight="bold">
                      {account.name}
                    </Text>
                    <Text size="1" color="gray" className={styles.capitalize}>
                      {account.type}
                    </Text>
                  </Box>
                  <Text size="4" weight="bold" className={styles.accountBalance}>
                    {formatCurrency(account.balance, currency)}
                  </Text>
                </Flex>
              </Card>
            ))}
          </Flex>
        )}

        <Card>
          <Flex align="center" justify="between" mb="2">
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
                <Flex key={t.id} className={styles.transactionRow} align="center" justify="between">
                  <Flex direction="column" gap="1" className={styles.flex1}>
                    <Text size="2" weight="medium" className={styles.description}>
                      {t.description}
                    </Text>
                    <Text size="1" color="gray">
                      {formatDate(t.date)}
                    </Text>
                  </Flex>
                  <Text
                    size="2"
                    weight="bold"
                    color={t.transaction_type === 'income' ? 'green' : 'red'}
                  >
                    {t.transaction_type === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount, currency)}
                  </Text>
                </Flex>
              ))}
            </Flex>
          )}
        </Card>

        <Card>
          <Heading size="3" mb="2">
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
                  <Flex direction="column" gap="1" className={styles.flex1}>
                    <Text size="2" weight="medium">
                      {bill.name}
                    </Text>
                    <Text size="1" color="gray">
                      {bill.has_paid
                        ? 'Paid'
                        : bill.days_until === 0
                          ? 'Due today'
                          : `${bill.days_until}d`}
                      {bill.is_variable && ' (est.)'}
                    </Text>
                  </Flex>
                  <Text size="2" weight="bold" color={bill.has_paid ? 'green' : undefined}>
                    {bill.has_paid ? '✓ ' : ''}
                    {formatCurrency(bill.amount, currency)}
                  </Text>
                </Flex>
              ))}
            </Flex>
          )}
        </Card>

        {refreshing && (
          <Flex justify="center" gap="2" align="center">
            <RefreshCw size={14} className={styles.spinning} />
            <Text size="1" color="gray">
              Refreshing...
            </Text>
          </Flex>
        )}
      </Flex>
    </Box>
  )
}
