import { useState, useEffect, useRef, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Flex, Heading, Text, Card } from '@radix-ui/themes'
import { Wallet, PiggyBank, CreditCard, TrendingUp, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../auth/api.ts'
import styles from './Home.module.css'

interface Account {
  id: number
  name: string
  type: string
  currency: string
  balance: number
  is_active: boolean
}

interface Transaction {
  id: number
  amount: number
  description: string
  transaction_type: string
  category_name: string | null
  category_color: string | null
  date: string
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
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [recentTx, setRecentTx] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  const fetchData = async () => {
    setRefreshing(true)
    try {
      const [acctsRes, txRes] = await Promise.all([
        api.get('/api/accounts/'),
        api.get('/api/transactions/', {
          params: { limit: 5, sort_by: 'date', sort_order: 'desc' },
        }),
      ])
      setAccounts(acctsRes.data)
      setRecentTx(txRes.data)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to load home data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return
    touchStartY.current = e.touches[0]!.clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const currentY = e.touches[0]!.clientY
    const diff = currentY - touchStartY.current
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
    <Box
      className={styles.page}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Box
        className={styles.pullIndicator}
        style={{
          height: pullDistance,
          opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
        }}
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
            ${totalBalance.toFixed(2)}
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
                    style={{ color: accountColors[account.type] || 'var(--gray-9)' }}
                  >
                    {accountIcons[account.type] || <Wallet size={20} />}
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="2" weight="bold">
                      {account.name}
                    </Text>
                    <Text size="1" color="gray" style={{ textTransform: 'capitalize' }}>
                      {account.type}
                    </Text>
                  </Box>
                  <Text size="4" weight="bold" className={styles.accountBalance}>
                    ${account.balance.toFixed(2)}
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
                  <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
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
                    {t.transaction_type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                  </Text>
                </Flex>
              ))}
            </Flex>
          )}
        </Card>

        <Card className={styles.placeholderCard}>
          <Flex direction="column" gap="2" align="center" py="3">
            <Text size="2" color="gray">
              Upcoming Bills
            </Text>
            <Text size="1" color="gray">
              Coming in a later phase
            </Text>
          </Flex>
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
