import { useState, useEffect, type JSX } from 'react'
import { Box, Flex, Heading, Text, Card, Badge } from '@radix-ui/themes'
import { ResponsivePie } from '@nivo/pie'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../auth/api.ts'
import styles from './Dashboard.module.css'

interface CategorySummary {
  category_id: number | null
  category_name: string
  category_color: string
  total_amount: number
  transaction_count: number
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

interface DashboardData {
  total_income: number
  total_expenses: number
  net_amount: number
  category_summaries: CategorySummary[]
  recent_transactions: Transaction[]
}

export const Dashboard = (): JSX.Element => {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/api/transactions/summary/dashboard')
        setData(response.data)
      } catch (error: any) {
        toast.error(error.response?.data?.detail || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading) {
    return <Text color="gray">Loading...</Text>
  }

  if (!data) {
    return <Text color="gray">No data available</Text>
  }

  const pieData = data.category_summaries.map((c) => ({
    id: c.category_name,
    label: c.category_name,
    value: c.total_amount,
    color: c.category_color,
  }))

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Box className={styles.page}>
      <Heading size="5" mb="4">
        Dashboard
      </Heading>

      <Flex direction="column" gap="3" mb="4">
        <Card size="1">
          <Flex align="center" justify="between">
            <Flex align="center" gap="2">
              <TrendingUp size={16} className={styles.incomeIcon} />
              <Text size="2" color="gray">
                Income
              </Text>
            </Flex>
            <Text size="4" weight="bold" color="green">
              +${data.total_income.toFixed(2)}
            </Text>
          </Flex>
        </Card>

        <Card size="1">
          <Flex align="center" justify="between">
            <Flex align="center" gap="2">
              <TrendingDown size={16} className={styles.expenseIcon} />
              <Text size="2" color="gray">
                Expenses
              </Text>
            </Flex>
            <Text size="4" weight="bold" color="red">
              -${data.total_expenses.toFixed(2)}
            </Text>
          </Flex>
        </Card>

        <Card size="1">
          <Flex align="center" justify="between">
            <Flex align="center" gap="2">
              <Wallet size={16} className={styles.netIcon} />
              <Text size="2" color="gray">
                Net
              </Text>
            </Flex>
            <Text size="4" weight="bold" color={data.net_amount >= 0 ? 'green' : 'red'}>
              ${data.net_amount.toFixed(2)}
            </Text>
          </Flex>
        </Card>
      </Flex>

      <Card size="1" mb="4">
        <Heading size="3" mb="3">
          Spending by Category
        </Heading>
        <Box className={styles.chartContainer}>
          {pieData.length > 0 ? (
            <ResponsivePie
              data={pieData}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              innerRadius={0.5}
              padAngle={2}
              cornerRadius={4}
              colors={{ datum: 'data.color' }}
              borderWidth={1}
              borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
              enableArcLinkLabels={false}
              arcLabelsSkipAngle={20}
              arcLabelsTextColor="#fff"
              arcLabel={(d) => `${d.value.toFixed(0)}`}
              legends={[
                {
                  anchor: 'bottom',
                  direction: 'row',
                  justify: false,
                  translateY: 40,
                  itemWidth: 80,
                  itemHeight: 18,
                  itemsSpacing: 8,
                  symbolSize: 12,
                  symbolShape: 'circle',
                },
              ]}
            />
          ) : (
            <Flex align="center" justify="center" className={styles.emptyChart}>
              <Text color="gray">No expenses yet</Text>
            </Flex>
          )}
        </Box>
      </Card>

      <Card size="1">
        <Heading size="3" mb="3">
          Recent
        </Heading>
        {data.recent_transactions.length === 0 ? (
          <Text color="gray">No transactions yet</Text>
        ) : (
          <Box>
            {data.recent_transactions.slice(0, 5).map((t) => (
              <Flex key={t.id} className={styles.transactionRow} align="center" justify="between">
                <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                  <Text size="2" weight="medium" className={styles.description}>
                    {t.description}
                  </Text>
                  <Flex gap="2" align="center">
                    {t.category_name && (
                      <Badge size="1" color={(t.category_color as any) || 'gray'}>
                        {t.category_name}
                      </Badge>
                    )}
                    <Text size="1" color="gray">
                      {formatDate(t.date)}
                    </Text>
                  </Flex>
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
          </Box>
        )}
      </Card>
    </Box>
  )
}
