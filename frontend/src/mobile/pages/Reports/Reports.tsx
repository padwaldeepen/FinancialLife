import { useState, useEffect, type JSX } from 'react'
import { Box, Flex, Heading, Text, Card, Badge, Select } from '@radix-ui/themes'
import { PieChart } from 'lucide-react'
import { ResponsiveBar } from '@nivo/bar'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import styles from './Reports.module.css'

export const Reports = (): JSX.Element => {
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const { monthly, summary, categories, comparison, loading, fetchReports } = useBoundStore(
    useShallow((s) => ({
      monthly: s.reports.monthly,
      summary: s.reports.summary,
      categories: s.reports.categories,
      comparison: s.reports.comparison,
      loading: s.reports.loading,
      fetchReports: s.fetchReports,
    })),
  )

  useEffect(() => {
    fetchReports(year)
  }, [fetchReports, year])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString())

  if (loading) {
    return <Text color="gray">Loading...</Text>
  }

  return (
    <Box className={styles.page}>
      <Flex align="center" justify="between" mb="4">
        <Heading size="5">Reports</Heading>
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
        <Flex direction="column" gap="2" mb="4">
          <Card size="1">
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Income (30d)
              </Text>
              <Heading size="4" className={styles.incomeText}>
                {formatCurrency(summary.total_income)}
              </Heading>
            </Flex>
          </Card>
          <Card size="1">
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Expenses (30d)
              </Text>
              <Heading size="4" className={styles.expenseText}>
                {formatCurrency(summary.total_expense)}
              </Heading>
            </Flex>
          </Card>
          <Card size="1">
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Net
              </Text>
              <Heading size="4" color={summary.net >= 0 ? undefined : 'red'}>
                {formatCurrency(summary.net)}
              </Heading>
            </Flex>
          </Card>
          <Card size="1">
            <Flex align="center" gap="2">
              <PieChart size={16} />
              <Text size="2" color="gray">
                Top category:
              </Text>
              <Text size="2" weight="bold">
                {summary.top_category || 'N/A'}
              </Text>
              {summary.top_category_amount && (
                <Text size="2" color="gray">
                  {formatCurrency(summary.top_category_amount)}
                </Text>
              )}
            </Flex>
          </Card>
        </Flex>
      )}

      {comparison && (
        <Card size="1" mb="4">
          <Text size="1" color="gray" mb="2" as="div">
            {comparison.label}
          </Text>
          <Flex direction="column" gap="1">
            {[
              {
                field: 'Income',
                current: comparison.current_income,
                pct: comparison.income_change_pct,
              },
              {
                field: 'Expenses',
                current: comparison.current_expense,
                pct: comparison.expense_change_pct,
              },
              { field: 'Net', current: comparison.current_net, pct: comparison.net_change_pct },
            ].map((row) => (
              <Flex key={row.field} align="center" justify="between">
                <Text size="2" color="gray">
                  {row.field}
                </Text>
                <Flex align="center" gap="2">
                  <Text size="2" weight="medium">
                    {formatCurrency(row.current)}
                  </Text>
                  <Text
                    size="1"
                    weight="bold"
                    color={
                      row.pct === null
                        ? 'gray'
                        : row.pct > 0
                          ? 'green'
                          : row.pct < 0
                            ? 'red'
                            : 'gray'
                    }
                  >
                    {row.pct === null ? '—' : `${row.pct > 0 ? '+' : ''}${row.pct}%`}
                  </Text>
                </Flex>
              </Flex>
            ))}
          </Flex>
        </Card>
      )}

      <Card size="1" mb="4">
        <Heading size="3" mb="3">
          Monthly ({year})
        </Heading>
        <Box className={styles.chartContainer}>
          <ResponsiveBar
            data={monthly as any}
            keys={['income', 'expense']}
            indexBy="month"
            margin={{ top: 10, right: 10, bottom: 30, left: 50 }}
            padding={0.3}
            groupMode="grouped"
            colors={['var(--green-9)', 'var(--red-9)']}
            axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 0 }}
            axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0 }}
            valueFormat=">-$0,"
            labelSkipWidth={12}
            labelSkipHeight={12}
            theme={{
              background: 'transparent',
              text: { fill: 'var(--gray-12)' },
              axis: { ticks: { text: { fill: 'var(--gray-11)' } } },
              grid: { line: { stroke: 'var(--gray-5)' } },
            }}
          />
        </Box>
      </Card>

      <Card size="1">
        <Heading size="3" mb="2">
          Spending by Category (90d)
        </Heading>
        {categories.length === 0 ? (
          <Text color="gray">No categorized expenses</Text>
        ) : (
          <Flex direction="column" gap="2">
            {categories.map((cat) => (
              <Flex key={cat.category_name} align="center" gap="2" className={styles.catRow}>
                <Box className={styles.colorDot} style={{ backgroundColor: cat.category_color }} />
                <Text size="2" style={{ flex: 1, minWidth: 0 }}>
                  {cat.category_name}
                </Text>
                <Badge size="1" color="gray">
                  {cat.transaction_count}
                </Badge>
                <Text size="2" weight="medium">
                  {formatCurrency(cat.total)}
                </Text>
                <Text size="1" color="gray" style={{ width: 36, textAlign: 'right' }}>
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
