import { useEffect, type JSX } from 'react'
import { Box, Flex, Text, Card, Grid, Select, Skeleton } from '@radix-ui/themes'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import { BreakdownChart } from './BreakdownChart.tsx'
import { ComparisonCard } from './ComparisonCard.tsx'
import { AnnualTimeline } from './AnnualTimeline.tsx'
import { NetWorthChart } from './NetWorthChart.tsx'
import styles from './Insights.module.css'
import { PageHeader } from '../../components/PageHeader/PageHeader.tsx'

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export const Insights = (): JSX.Element => {
  const currency = useActiveCurrency()
  const today = new Date()
  const { year, month, setInsightsYear, setInsightsMonth } = useBoundStore(
    useShallow((s) => s.insightsPeriod),
  )

  const {
    monthly,
    periodCategories,
    periodMerchants,
    periodComparisonMoM,
    periodComparisonYoY,
    periodLoading,
    fetchMonthly,
    fetchInsightsPeriod,
  } = useBoundStore(
    useShallow((s) => ({
      monthly: s.reports.monthly,
      periodCategories: s.reports.periodCategories,
      periodMerchants: s.reports.periodMerchants,
      periodComparisonMoM: s.reports.periodComparisonMoM,
      periodComparisonYoY: s.reports.periodComparisonYoY,
      periodLoading: s.reports.periodLoading,
      fetchMonthly: s.reports.fetchMonthly,
      fetchInsightsPeriod: s.reports.fetchInsightsPeriod,
    })),
  )

  useEffect(() => {
    fetchMonthly(year)
  }, [fetchMonthly, year])

  useEffect(() => {
    fetchInsightsPeriod(year, month)
  }, [fetchInsightsPeriod, year, month])

  const currentYear = today.getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  const handleSelectMonth = (m: number) => {
    setInsightsMonth(m)
  }

  return (
    <Box>
      <PageHeader
        action={
          <Flex align="center" gap="2">
            <Select.Root value={String(month)} onValueChange={(v) => setInsightsMonth(Number(v))}>
              <Select.Trigger />
              <Select.Content>
                {MONTH_NAMES.map((m, i) => (
                  <Select.Item key={m} value={String(i + 1)}>
                    {m}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Select.Root value={String(year)} onValueChange={(v) => setInsightsYear(Number(v))}>
              <Select.Trigger />
              <Select.Content>
                {years.map((y) => (
                  <Select.Item key={y} value={String(y)}>
                    {y}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        }
      />

      {periodLoading && !periodComparisonMoM ? (
        <Flex direction="column" gap="3" p="4">
          <Skeleton>
            <Box style={{ height: 100 }} />
          </Skeleton>
          <Skeleton>
            <Box style={{ height: 200 }} />
          </Skeleton>
        </Flex>
      ) : (
        <>
          {periodComparisonMoM && (
            <Grid columns="3" gap="3" mb="5">
              <Card size="2" className={styles.statCard}>
                <Text as="div" className={styles.statLabel}>
                  Income
                </Text>
                <Flex align="center" gap="2">
                  <TrendingUp size={18} className={styles.incomeIcon} />
                  <Text className={styles.statValuePositive}>
                    {formatCurrency(periodComparisonMoM.current_income, currency)}
                  </Text>
                </Flex>
              </Card>
              <Card size="2" className={styles.statCard}>
                <Text as="div" className={styles.statLabel}>
                  Expenses
                </Text>
                <Flex align="center" gap="2">
                  <TrendingDown size={18} className={styles.expenseIcon} />
                  <Text className={styles.statValueNegative}>
                    {formatCurrency(periodComparisonMoM.current_expense, currency)}
                  </Text>
                </Flex>
              </Card>
              <Card size="2" className={styles.statCard}>
                <Text as="div" className={styles.statLabel}>
                  Net
                </Text>
                <Flex align="center" gap="2">
                  <DollarSign
                    size={18}
                    color={
                      periodComparisonMoM.current_net >= 0
                        ? 'var(--money-positive)'
                        : 'var(--money-negative)'
                    }
                  />
                  <Text
                    className={
                      periodComparisonMoM.current_net >= 0
                        ? styles.statValuePositive
                        : styles.statValueNegative
                    }
                  >
                    {formatCurrency(periodComparisonMoM.current_net, currency)}
                  </Text>
                </Flex>
              </Card>
            </Grid>
          )}

          <Grid columns="2" gap="4" mb="5">
            {periodComparisonMoM && (
              <ComparisonCard
                title="Month over month"
                comparison={periodComparisonMoM}
                currency={currency}
              />
            )}
            {periodComparisonYoY && (
              <ComparisonCard
                title="Year over year"
                comparison={periodComparisonYoY}
                currency={currency}
              />
            )}
          </Grid>

          {/* Y2: net worth leads the page — it's the one number that answers "am I
              getting ahead?", which the app previously couldn't say at all. */}
          <Card size="2" className={styles.chartCard}>
            <Text as="div" size="2" weight="medium" mb="3">
              Net worth
            </Text>
            <NetWorthChart />
          </Card>

          <Card size="2" className={styles.chartCard}>
            <Text as="div" className={styles.chartTitle}>
              {MONTH_NAMES[month - 1]} {year} — by category
            </Text>
            <BreakdownChart
              items={periodCategories.map((c) => ({
                name: c.category_name,
                total: c.total,
                percentage: c.percentage,
              }))}
              currency={currency}
              emptyLabel="No categorized expenses this month"
            />
          </Card>

          <Card size="2" className={styles.chartCard}>
            <Text as="div" className={styles.chartTitle}>
              {MONTH_NAMES[month - 1]} {year} — by merchant
            </Text>
            <BreakdownChart
              items={periodMerchants.map((m) => ({
                name: m.merchant_name,
                total: m.total,
                percentage: m.percentage,
              }))}
              currency={currency}
              emptyLabel="No merchant data this month"
            />
          </Card>

          <Card size="2" className={styles.chartCard}>
            <Text as="div" className={styles.chartTitle}>
              {year} — annual timeline
            </Text>
            <AnnualTimeline
              year={year}
              monthly={monthly}
              currency={currency}
              onSelectMonth={handleSelectMonth}
            />
          </Card>
        </>
      )}
    </Box>
  )
}
