import { useEffect, type JSX } from 'react'
import { Box, Text, Flex } from '@radix-ui/themes'
import { ResponsiveBar } from '@nivo/bar'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import styles from './Insights.module.css'

// Y2: net worth over time — the number the app could never answer before.
//
// A bar chart rather than a line: these are discrete month-end positions, not a
// continuous signal, and it matches AnnualTimeline's existing monthly treatment. It also
// avoids adding `@nivo/line` purely for this (the bundle already grew once for exceljs).
//
// One series, so one hue (`--chart-single`) — the month labels on the axis carry
// identity and the bar height carries magnitude, so colour would encode nothing.
export const NetWorthChart = (): JSX.Element | null => {
  const currency = useActiveCurrency()
  const { points, insufficientData, monthsAvailable, loading, fetchNetWorth } = useBoundStore(
    useShallow((s) => ({
      points: s.netWorth.points,
      insufficientData: s.netWorth.insufficientData,
      monthsAvailable: s.netWorth.monthsAvailable,
      loading: s.netWorth.loading,
      fetchNetWorth: s.netWorth.fetchNetWorth,
    })),
  )

  useEffect(() => {
    fetchNetWorth()
  }, [fetchNetWorth])

  if (loading) return null

  // Honesty gate (same principle as I3/I4): two points is not a trend. Say why rather
  // than drawing a line that implies more than the data supports.
  if (insufficientData) {
    return (
      <Text as="div" color="gray" size="2">
        Needs about 3 months of history to show a net-worth trend — {monthsAvailable}{' '}
        {monthsAvailable === 1 ? 'month' : 'months'} so far.
      </Text>
    )
  }

  const latest = points[points.length - 1]
  const first = points[0]
  const change = latest && first ? latest.net_worth - first.net_worth : 0

  return (
    <Box>
      <Flex align="baseline" gap="3" mb="2">
        <Text size="6" weight="bold">
          {latest ? formatCurrency(latest.net_worth, currency) : '—'}
        </Text>
        <Text size="2" color="gray">
          {change >= 0 ? '+' : ''}
          {formatCurrency(change, currency)} since {first?.month}
        </Text>
      </Flex>
      <Box className={styles.chartHeight220}>
        <ResponsiveBar
          data={points.map((p) => ({ month: p.month, net: p.net_worth }))}
          keys={['net']}
          indexBy="month"
          margin={{ top: 8, right: 16, bottom: 40, left: 72 }}
          padding={0.3}
          colors={['var(--chart-single)']}
          borderRadius={2}
          enableLabel={false}
          axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: -45 }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            format: (v: number) => formatCurrency(Number(v), currency),
          }}
          enableGridX={false}
          gridYValues={5}
          theme={{
            text: { fill: 'var(--gray-11)', fontSize: 11 },
            axis: { ticks: { text: { fill: 'var(--gray-11)' } } },
            grid: { line: { stroke: 'var(--chart-grid)' } },
          }}
          tooltip={({ value, indexValue }) => (
            <Box className={styles.chartTooltip}>
              <Text size="1" color="gray" as="div">
                {String(indexValue)}
              </Text>
              <Text size="2" weight="bold">
                {formatCurrency(Number(value), currency)}
              </Text>
            </Box>
          )}
        />
      </Box>
    </Box>
  )
}
