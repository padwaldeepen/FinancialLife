import { useState, useEffect, type JSX } from 'react'
import { Box, Flex, Text, Card, Grid, Badge, Button, Select } from '@radix-ui/themes'
import { DollarSign, TrendingUp, TrendingDown, PieChart, Download } from 'lucide-react'
import { ResponsiveBar } from '@nivo/bar'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import api from '../../../auth/api.ts'
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

  const handleExport = async () => {
    try {
      const res = await api.get('/api/export/csv', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `my-financial-life-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      // export failed silently
    }
  }

  if (loading) {
    return <Text color="gray">Loading...</Text>
  }

  return (
    <Box className={styles.page}>
      <Flex className={styles.pageHeader}>
        <span className={styles.pageTitle}>Reports</span>
        <Flex align="center" gap="3">
          <Button variant="outline" size="2" onClick={handleExport}>
            <Download size={14} />
            Export CSV
          </Button>
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
      </Flex>

      {summary && (
        <Grid columns="4" gap="3" mb="5">
          <Card size="2" className={styles.statCard}>
            <div className={styles.statLabel}>Income (30d)</div>
            <Flex align="center" gap="2">
              <TrendingUp size={18} className={styles.incomeIcon} />
              <span className={`${styles.statValue} ${styles.incomeText}`}>
                {formatCurrency(summary.total_income)}
              </span>
            </Flex>
          </Card>
          <Card size="2" className={styles.statCard}>
            <div className={styles.statLabel}>Expenses (30d)</div>
            <Flex align="center" gap="2">
              <TrendingDown size={18} className={styles.expenseIcon} />
              <span className={`${styles.statValue} ${styles.expenseText}`}>
                {formatCurrency(summary.total_expense)}
              </span>
            </Flex>
          </Card>
          <Card size="2" className={styles.statCard}>
            <div className={styles.statLabel}>Net</div>
            <Flex align="center" gap="2">
              <DollarSign size={18} color={summary.net >= 0 ? 'var(--green-9)' : 'var(--red-9)'} />
              <span
                className={`${styles.statValue} ${
                  summary.net >= 0 ? styles.netPositive : styles.netNegative
                }`}
              >
                {formatCurrency(summary.net)}
              </span>
            </Flex>
          </Card>
          <Card size="2" className={styles.statCard}>
            <div className={styles.statLabel}>Top Category</div>
            <Flex align="center" gap="2">
              <PieChart size={18} />
              <span className={styles.statValue}>{summary.top_category || 'N/A'}</span>
              {summary.top_category_amount && (
                <Text size="2" color="gray">
                  {formatCurrency(summary.top_category_amount)}
                </Text>
              )}
            </Flex>
          </Card>
        </Grid>
      )}

      {comparison && (
        <Card size="2" className={styles.comparisonCard}>
          <div className={styles.comparisonLabel}>{comparison.label}</div>
          {[
            {
              field: 'Income',
              current: comparison.current_income,
              prev: comparison.previous_income,
              pct: comparison.income_change_pct,
            },
            {
              field: 'Expenses',
              current: comparison.current_expense,
              prev: comparison.previous_expense,
              pct: comparison.expense_change_pct,
            },
            {
              field: 'Net',
              current: comparison.current_net,
              prev: comparison.previous_net,
              pct: comparison.net_change_pct,
            },
          ].map((row) => (
            <div key={row.field} className={styles.comparisonRow}>
              <span className={styles.comparisonFieldName}>{row.field}</span>
              <div className={styles.comparisonValues}>
                <span className={styles.comparisonCurrent}>{formatCurrency(row.current)}</span>
                <span className={styles.comparisonPrev}>{formatCurrency(row.prev)}</span>
                <span
                  className={`${styles.comparisonChange} ${
                    row.pct === null
                      ? styles.changeNeutral
                      : row.pct > 0
                        ? styles.changePositive
                        : row.pct < 0
                          ? styles.changeNegative
                          : styles.changeNeutral
                  }`}
                >
                  {row.pct === null ? '—' : `${row.pct > 0 ? '+' : ''}${row.pct}%`}
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card size="2" className={styles.chartCard}>
        <div className={styles.chartTitle}>Monthly Income vs Expenses ({year})</div>
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

      <Card size="2" className={styles.chartCard}>
        <div className={styles.chartTitle}>Spending by Category (90d)</div>
        {categories.length === 0 ? (
          <Text color="gray">No categorized expenses</Text>
        ) : (
          <Flex direction="column" gap="2">
            {categories.map((cat) => (
              <Flex key={cat.category_name} align="center" gap="3" className={styles.catRow}>
                <Box
                  className={styles.colorDot}
                  style={{ '--cat-color': cat.category_color } as React.CSSProperties}
                />
                <Text size="2" className={styles.flex1}>
                  {cat.category_name}
                </Text>
                <Badge size="1" color="gray">
                  {cat.transaction_count} tx
                </Badge>
                <Text size="2" weight="medium" className={styles.colAmount}>
                  {formatCurrency(cat.total)}
                </Text>
                <Text size="1" color="gray" className={styles.colCount}>
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
