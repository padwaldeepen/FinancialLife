import { useRef, type JSX } from 'react'
import { Box, Flex, Text, Skeleton } from '@radix-ui/themes'
import { ResponsiveBar } from '@nivo/bar'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import type { CategoryTotal } from '../../../store/slices/reportsSlice.ts'
import { BreakdownChart } from './BreakdownChart.tsx'
import styles from './Insights.module.css'

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

interface MonthlyEntry {
  month: string
  income: number
  expense: number
  net: number
}

interface Props {
  year: number
  monthly: MonthlyEntry[]
  currency: string
  onSelectMonth: (month: number) => void
}

// The "annual view" and the "interactive spending timeline" are one chart, not two
// (design-system.md §0/§3 describe scrubbing through the SAME 12-month view to reveal
// per-month category breakdowns — a second, separate 12-bar chart next to this one
// would just be redundant UI). Hover previews a month's breakdown without changing the
// selected period; click pins it as the active month for the rest of the page.
export const AnnualTimeline = ({ year, monthly, currency, onSelectMonth }: Props): JSX.Element => {
  const fetchCategoriesForMonth = useBoundStore((s) => s.reports.fetchCategoriesForMonth)
  const {
    hoverMonth,
    hoverBreakdown,
    loadingHover,
    setAnnualTimelineHoverMonth,
    setAnnualTimelineHoverBreakdown,
    setAnnualTimelineLoadingHover,
  } = useBoundStore(useShallow((s) => s.annualTimeline))
  const cacheRef = useRef<Map<string, CategoryTotal[]>>(new Map())

  const previewMonth = async (monthName: string) => {
    const month = MONTH_NAMES.indexOf(monthName) + 1
    if (month === 0) return
    setAnnualTimelineHoverMonth(month)
    const key = `${year}-${month}`
    const cached = cacheRef.current.get(key)
    if (cached) {
      setAnnualTimelineHoverBreakdown(cached)
      return
    }
    setAnnualTimelineLoadingHover(true)
    try {
      const data = await fetchCategoriesForMonth(year, month)
      cacheRef.current.set(key, data)
      setAnnualTimelineHoverBreakdown(data)
    } finally {
      setAnnualTimelineLoadingHover(false)
    }
  }

  return (
    <Flex gap="5" className={styles.timelineRow}>
      <Box className={styles.timelineChart}>
        <ResponsiveBar
          data={monthly as unknown as Record<string, string | number>[]}
          keys={['income', 'expense']}
          indexBy="month"
          margin={{ top: 10, right: 20, bottom: 30, left: 60 }}
          padding={0.3}
          groupMode="grouped"
          colors={['var(--money-positive)', 'var(--money-negative)']}
          axisBottom={{ tickSize: 5, tickPadding: 5 }}
          axisLeft={{ tickSize: 5, tickPadding: 5 }}
          valueFormat=">-$0,"
          labelSkipWidth={12}
          labelSkipHeight={12}
          onMouseEnter={(datum) => previewMonth(String(datum.indexValue))}
          onClick={(datum) => onSelectMonth(MONTH_NAMES.indexOf(String(datum.indexValue)) + 1)}
          tooltip={() => <Box />}
          theme={{
            background: 'transparent',
            text: { fill: 'var(--gray-12)' },
            axis: { ticks: { text: { fill: 'var(--gray-11)' } } },
            grid: { line: { stroke: 'var(--gray-5)' } },
          }}
        />
      </Box>
      <Box className={styles.timelinePreview}>
        <Text as="div" size="2" weight="medium" mb="2">
          {hoverMonth ? `${MONTH_NAMES[hoverMonth - 1]} ${year} — where it went` : 'Hover a month'}
        </Text>
        {loadingHover ? (
          <Skeleton>
            <Box style={{ height: 120 }} />
          </Skeleton>
        ) : hoverMonth && hoverBreakdown ? (
          <BreakdownChart
            items={hoverBreakdown.map((c) => ({
              name: c.category_name,
              total: c.total,
              percentage: c.percentage,
            }))}
            currency={currency}
            emptyLabel="No expenses that month"
          />
        ) : (
          <Text size="2" color="gray">
            Hover any bar to preview that month&apos;s category breakdown, or click to jump to it.
          </Text>
        )}
      </Box>
    </Flex>
  )
}
