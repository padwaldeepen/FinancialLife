import { useEffect, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Flex, Text, Heading, Card, Skeleton } from '@radix-ui/themes'
import { Wallet, PiggyBank, CreditCard, TrendingUp } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency, formatDate } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import { useHomeData } from '../../../shared/hooks/useHomeData.ts'
import { useSafeToSpend } from '../../../shared/hooks/useSafeToSpend.ts'
import { InsightCards } from './InsightCards.tsx'
import styles from './Home.module.css'
import shared from '../../styles/shared.module.css'

const accountIcons: Record<string, JSX.Element> = {
  checking: <Wallet size={22} />,
  savings: <PiggyBank size={22} />,
  credit: <CreditCard size={22} />,
  cash: <Wallet size={22} />,
  investment: <TrendingUp size={22} />,
}

export const Home = (): JSX.Element => {
  const currency = useActiveCurrency()
  const navigate = useNavigate()
  const { accounts, cashOnHand, creditOwed, recentTransactions, upcomingBills, loading } =
    useHomeData()
  const { summary, fetchReports } = useBoundStore(
    useShallow((s) => ({ summary: s.reports.summary, fetchReports: s.reports.fetchReports })),
  )
  const safeToSpend = useSafeToSpend(currency)

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  if (loading) {
    return (
      <Flex direction="column" gap="4">
        <Skeleton>
          <Box className={`${styles.balanceCard} ${styles.chartArea}`} />
        </Skeleton>
        <Skeleton>
          <Box className={styles.miniChart} />
        </Skeleton>
        <Skeleton>
          <Box className={styles.miniChart} />
        </Skeleton>
      </Flex>
    )
  }

  return (
    <Box>
      <Flex className={styles.layout}>
        <Box className={styles.leftColumn}>
          {/* Safe-to-Spend Hero — I5, wired to GET /api/insights/safe-to-spend */}
          <Card className={styles.balanceCard}>
            <Text className={styles.balanceLabel}>Safe to Spend</Text>
            <Heading className={styles.balanceAmount}>
              {safeToSpend.insufficientData || safeToSpend.amount === null
                ? '—'
                : formatCurrency(safeToSpend.amount, currency)}
            </Heading>
            <Text className={styles.balanceAccounts}>
              {safeToSpend.insufficientData
                ? 'Needs about 2 months of transaction history for an accurate forecast'
                : (safeToSpend.subLine ?? 'No upcoming payday detected yet')}
            </Text>
          </Card>

          {/* Cash on hand / Credit owed — never summed, a credit balance is debt, not
              spendable money */}
          <Flex gap="3">
            <Card className={styles.statCard}>
              <Text size="1" color="gray">
                Cash on hand
              </Text>
              <Text size="5" weight="bold" className={styles.statAmount}>
                {formatCurrency(cashOnHand, currency)}
              </Text>
            </Card>
            {creditOwed > 0 && (
              <Card className={styles.statCard}>
                <Text size="1" color="gray">
                  Credit owed
                </Text>
                <Text size="5" weight="bold" className={styles.statAmountNegative}>
                  {formatCurrency(creditOwed, currency)}
                </Text>
              </Card>
            )}
          </Flex>

          {/* Accounts */}
          <Box>
            <Flex className={shared.sectionHeader}>
              <Text className={styles.sectionTitle}>Accounts</Text>
            </Flex>
            {accounts.length === 0 ? (
              <Box className={styles.emptyState}>
                <Text color="gray">No accounts yet</Text>
              </Box>
            ) : (
              <Flex direction="column" gap="2" className={styles.accountsList}>
                {accounts.map((account) => (
                  <Card key={account.id} className={styles.accountCard}>
                    <Flex align="center" gap="3">
                      <Box className={styles.accountIcon}>
                        {accountIcons[account.type] || <Wallet size={22} />}
                      </Box>
                      <Box className={styles.accountInfo}>
                        <Text as="div" className={styles.accountName}>
                          {account.name}
                        </Text>
                        <Text as="div" className={styles.accountType}>
                          {account.type}
                        </Text>
                      </Box>
                      <Text as="div" className={styles.accountBalance}>
                        {formatCurrency(account.balance, currency)}
                      </Text>
                    </Flex>
                  </Card>
                ))}
              </Flex>
            )}
          </Box>
        </Box>

        <Box className={styles.rightColumn}>
          {/* This Month */}
          <Card className={styles.contentCard}>
            <Flex className={shared.sectionHeader}>
              <Text className={styles.sectionTitle}>This Month</Text>
            </Flex>
            {summary ? (
              <Flex justify="between">
                <Flex direction="column" gap="1">
                  <Text size="1" color="gray">
                    Income
                  </Text>
                  <Text size="4" weight="bold" className={styles.statAmountPositive}>
                    {formatCurrency(summary.total_income, currency)}
                  </Text>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="1" color="gray">
                    Spent
                  </Text>
                  <Text size="4" weight="bold">
                    {formatCurrency(summary.total_expense, currency)}
                  </Text>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="1" color="gray">
                    Net
                  </Text>
                  <Text
                    size="4"
                    weight="bold"
                    className={
                      summary.net >= 0 ? styles.statAmountPositive : styles.statAmountNegative
                    }
                  >
                    {formatCurrency(summary.net, currency)}
                  </Text>
                </Flex>
              </Flex>
            ) : (
              <Text size="2" color="gray">
                No data yet
              </Text>
            )}
          </Card>

          {/* Insights — I6, rule-generated advice cards wired to GET /api/insights/advice */}
          <InsightCards />

          {/* Recent Activity */}
          <Card className={styles.contentCard}>
            <Flex className={shared.sectionHeader}>
              <Text className={styles.sectionTitle}>Recent Activity</Text>
              <Text className={styles.seeAll} onClick={() => navigate('/activity')}>
                See all
              </Text>
            </Flex>
            {recentTransactions.length === 0 ? (
              <Box className={styles.emptyState}>
                <Text color="gray" size="2">
                  No transactions yet
                </Text>
              </Box>
            ) : (
              <Box className={styles.txList}>
                {recentTransactions.map((t) => (
                  <Flex
                    key={t.id}
                    className={styles.txRow}
                    align="center"
                    justify="between"
                    gap="3"
                  >
                    <Flex direction="column" gap="1" className={styles.flex1}>
                      <Text as="div" className={styles.txDescription}>
                        {t.description}
                      </Text>
                      <Text as="div" className={styles.txDate}>
                        {formatDate(t.date)}
                      </Text>
                    </Flex>
                    <Text
                      as="div"
                      className={styles.txAmount}
                      style={
                        {
                          '--tx-color':
                            t.transaction_type === 'income'
                              ? 'var(--money-positive)'
                              : 'var(--gray-12)',
                        } as React.CSSProperties
                      }
                    >
                      {t.transaction_type === 'income' ? '+' : '-'}
                      {formatCurrency(t.amount, currency)}
                    </Text>
                  </Flex>
                ))}
              </Box>
            )}
          </Card>

          {/* Upcoming Bills */}
          <Card className={styles.contentCard}>
            <Flex className={shared.sectionHeader}>
              <Text className={styles.sectionTitle}>Upcoming Bills</Text>
              <Text className={styles.seeAll} onClick={() => navigate('/recurring')}>
                See all
              </Text>
            </Flex>
            {upcomingBills.length === 0 ? (
              <Box className={styles.emptyState}>
                <Text color="gray" size="2">
                  No upcoming bills
                </Text>
              </Box>
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
                          '--bill-color': bill.has_paid ? 'var(--money-positive)' : undefined,
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
