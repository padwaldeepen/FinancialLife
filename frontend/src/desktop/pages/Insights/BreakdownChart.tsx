import { type JSX } from 'react'
import { Box, Text } from '@radix-ui/themes'
import { ResponsiveBar } from '@nivo/bar'
import { formatCurrency } from '../../../shared/utils/format.ts'

interface BreakdownItem {
  name: string
  total: number
  percentage: number
}

interface Props {
  items: BreakdownItem[]
  currency: string
  emptyLabel: string
}

// Design-system.md §1 rule 3: "A pie chart with 8 rainbow slices becomes a sorted
// slate bar list with the top item in accent." Backend already returns rows sorted by
// total desc, so the first row is always the top spender — accent marks it, everything
// else stays neutral slate. Shared by category and merchant breakdowns (U6) — same
// chart, different data.
export const BreakdownChart = ({ items, currency, emptyLabel }: Props): JSX.Element => {
  if (items.length === 0) {
    return (
      <Text color="gray" size="2">
        {emptyLabel}
      </Text>
    )
  }

  // Z3: one hue for the whole series. This is a *labelled ranked* bar chart — the axis
  // already names every category and the bar length already encodes rank, so colour was
  // carrying no information. It previously highlighted the top bar in accent and greyed
  // the rest, which is colour-by-rank: re-sort or filter the data and every bar changes
  // colour while meaning the same thing.
  const top = items.slice(0, 8)
  const data = top.map((item) => ({ name: item.name, total: item.total }))

  return (
    <Box style={{ height: Math.max(top.length, 1) * 40 + 20 }}>
      <ResponsiveBar
        data={data}
        keys={['total']}
        indexBy="name"
        layout="horizontal"
        margin={{ top: 4, right: 24, bottom: 4, left: 120 }}
        padding={0.3}
        colors={['var(--chart-single)']}
        borderRadius={2}
        axisTop={null}
        axisRight={null}
        axisBottom={null}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        enableGridX={false}
        enableGridY={false}
        valueFormat={(v) => formatCurrency(v, currency)}
        labelSkipWidth={9999}
        theme={{
          background: 'transparent',
          text: { fill: 'var(--gray-12)' },
          axis: { ticks: { text: { fill: 'var(--gray-11)', fontSize: 12 } } },
        }}
        tooltip={({ data: d }) => (
          <Box
            style={{
              background: 'var(--color-panel-solid)',
              border: '1px solid var(--gray-5)',
              borderRadius: 'var(--radius-2)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--font-size-2)',
            }}
          >
            {d.name}: {formatCurrency(d.total as number, currency)}
          </Box>
        )}
      />
    </Box>
  )
}
