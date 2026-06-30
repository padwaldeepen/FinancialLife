import { useState, useEffect, type JSX } from 'react'
import { Box, Flex, Heading, Text, Card, Grid, Badge, Select } from '@radix-ui/themes'
import { DollarSign, TrendingUp, TrendingDown, PieChart } from 'lucide-react'
import { ResponsiveBar } from '@nivo/bar'
import api from '../../../auth/api.ts'
import styles from './Reports.module.css'

interface MonthlyEntry {
  month: string
  income: number
  expense: number
  net: number
}

interface Summary {
  total_income: number
  total_expense: number
  net: number
  transaction_count: number
  avg_daily_expense: number
  top_category: string | null
  top_category_amount: number | null
}

interface CategoryTotal {
  category_name: string
  category_color: string
  total: number
  percentage: number
  transaction_count: number
}

export const Reports = (): JSX.Element => {
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [monthly, setMonthly] = useState<MonthlyEntry[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [categories, setCategories] = useState<CategoryTotal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [monthlyRes, summaryRes, catRes] = await Promise.all([
          api.get(`/api/reports/monthly?year=${year}`),
          api.get('/api/reports/summary?days=30'),
          api.get('/api/reports/categories?days=90'),
        ])
        setMonthly(monthlyRes.data)
        setSummary(summaryRes.data)
        setCategories(catRes.data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [year])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString())

  if (loading) {
    return <Text color="gray">Loading...</Text>
  }

  return (
    <Box className={styles.page}>
      <Flex align="center" justify="between" mb="5">
        <Heading size="6">Reports</Heading>
        <Select.Root value={year} onValueChange={setYear}>
          <Select.Trigger />
          <Select.Content>
            {years.map((y) => (
              <Select.Item key={y} value={y}>
                {y}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>

      {summary && (
        <Grid columns="4" gap="3" mb="5">
          <Card size="2">
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Income (30d)
              </Text>
              <Flex align="center" gap="2">
                <TrendingUp size={18} className={styles.incomeIcon} />
                <Heading size="5" className={styles.incomeText}>
                  ${summary.total_income.toFixed(2)}
                </Heading>
              </Flex>
            </Flex>
          </Card>
          <Card size="2">
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Expenses (30d)
              </Text>
              <Flex align="center" gap="2">
                <TrendingDown size={18} className={styles.expenseIcon} />
                <Heading size="5" className={styles.expenseText}>
                  ${summary.total_expense.toFixed(2)}
                </Heading>
              </Flex>
            </Flex>
          </Card>
          <Card size="2">
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Net
              </Text>
              <Flex align="center" gap="2">
                <DollarSign
                  size={18}
                  color={summary.net >= 0 ? 'var(--green-9)' : 'var(--red-9)'}
                />
                <Heading size="5" color={summary.net >= 0 ? undefined : 'red'}>
                  ${summary.net.toFixed(2)}
                </Heading>
              </Flex>
            </Flex>
          </Card>
          <Card size="2">
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Top Category
              </Text>
              <Flex align="center" gap="2">
                <PieChart size={18} />
                <Text size="3" weight="bold">
                  {summary.top_category || 'N/A'}
                </Text>
                {summary.top_category_amount && (
                  <Text size="2" color="gray">
                    ${summary.top_category_amount.toFixed(2)}
                  </Text>
                )}
              </Flex>
            </Flex>
          </Card>
        </Grid>
      )}

      <Card size="2" mb="5">
        <Heading size="4" mb="4">
          Monthly Income vs Expenses ({year})
        </Heading>
        <Box className={styles.chartContainer}>
          <ResponsiveBar
            data={monthly as any}
            keys={['income', 'expense']}
            indexBy="month"
            margin={{ top: 10, right: 20, bottom: 40, left: 60 }}
            padding={0.3}
            groupMode="grouped"
            colors={['var(--green-9)', 'var(--red-9)']}
            axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 0 }}
            axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0 }}
            valueFormat=">-$0,"
            labelSkipWidth={12}
            labelSkipHeight={12}
            legends={[
              {
                dataFrom: 'keys',
                anchor: 'top-right',
                direction: 'row',
                translateY: -30,
                itemWidth: 80,
                itemHeight: 20,
                symbolSize: 12,
              },
            ]}
            theme={{
              background: 'transparent',
              text: { fill: 'var(--gray-12)' },
              axis: { ticks: { text: { fill: 'var(--gray-11)' } } },
              grid: { line: { stroke: 'var(--gray-5)' } },
            }}
          />
        </Box>
      </Card>

      <Card size="2">
        <Heading size="4" mb="3">
          Spending by Category (90d)
        </Heading>
        {categories.length === 0 ? (
          <Text color="gray">No categorized expenses</Text>
        ) : (
          <Flex direction="column" gap="2">
            {categories.map((cat) => (
              <Flex key={cat.category_name} align="center" gap="3" className={styles.catRow}>
                <Box className={styles.colorDot} style={{ backgroundColor: cat.category_color }} />
                <Text size="2" style={{ flex: 1 }}>
                  {cat.category_name}
                </Text>
                <Badge size="1" color="gray">
                  {cat.transaction_count} tx
                </Badge>
                <Text size="2" weight="medium" style={{ width: 80, textAlign: 'right' }}>
                  ${cat.total.toFixed(2)}
                </Text>
                <Text size="1" color="gray" style={{ width: 44, textAlign: 'right' }}>
                  {cat.percentage}%
                </Text>
              </Flex>
            ))}
          </Flex>
        )}
      </Card>
    </Box>
  )
}
