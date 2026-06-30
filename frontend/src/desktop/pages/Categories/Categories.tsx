import { useState, useEffect, type JSX } from 'react'
import { Box, Flex, Heading, Text, Card, Badge, Tabs } from '@radix-ui/themes'
import { Tags, ChevronRight, PieChart } from 'lucide-react'
import { ResponsivePie } from '@nivo/pie'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Categories.module.css'

export const Categories = (): JSX.Element => {
  const { tree, loading, spending, spendingLoading, fetchCategories, fetchSpendingByCategory } =
    useBoundStore(
      useShallow((s) => ({
        tree: s.categories.tree,
        loading: s.categories.loading,
        spending: s.categories.spending,
        spendingLoading: s.categories.spendingLoading,
        fetchCategories: s.fetchCategories,
        fetchSpendingByCategory: s.fetchSpendingByCategory,
      })),
    )
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [tab, setTab] = useState('list')

  useEffect(() => {
    fetchCategories()
    fetchSpendingByCategory()
  }, [fetchCategories, fetchSpendingByCategory])

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const parents = tree.filter((c) => !c.parent_id)
  const getChildren = (parentId: number) => tree.filter((c) => c.parent_id === parentId)

  const hasSpendingData = spending.length > 0

  return (
    <Box className={styles.page}>
      <Heading size="6" mb="5">
        Categories
      </Heading>

      <Tabs.Root value={tab} onValueChange={setTab} mb="5">
        <Tabs.List>
          <Tabs.Trigger value="list">
            <Tags size={16} /> List
          </Tabs.Trigger>
          <Tabs.Trigger value="analytics">
            <PieChart size={16} /> Analytics
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {tab === 'analytics' && (
        <Box mb="5">
          {spendingLoading ? (
            <Text color="gray">Loading analytics...</Text>
          ) : hasSpendingData ? (
            <>
              <Box className={styles.chartContainer}>
                <ResponsivePie
                  data={spending.map((s) => ({
                    id: s.name,
                    label: s.name,
                    value: s.total,
                    color: s.color,
                  }))}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  innerRadius={0.5}
                  padAngle={2}
                  cornerRadius={4}
                  activeOuterRadiusOffset={8}
                  colors={{ datum: 'data.color' }}
                  borderWidth={1}
                  borderColor={{ theme: 'background' }}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="var(--gray-12)"
                  arcLinkLabelsThickness={2}
                  arcLinkLabelsColor={{ from: 'color' }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor="var(--gray-1)"
                  valueFormat=">-$0,"
                  legends={[
                    {
                      anchor: 'bottom',
                      direction: 'row',
                      translateY: 56,
                      itemWidth: 100,
                      itemHeight: 18,
                      itemTextColor: 'var(--gray-11)',
                      symbolSize: 12,
                      symbolShape: 'circle',
                    },
                  ]}
                  theme={{
                    background: 'transparent',
                    text: { fill: 'var(--gray-12)' },
                  }}
                />
              </Box>

              <Flex direction="column" gap="2" mt="4">
                <Text size="2" weight="medium" mb="2">
                  Breakdown
                </Text>
                {spending.map((s) => (
                  <Flex key={s.id} align="center" gap="3" className={styles.spendingRow}>
                    <Box className={styles.colorDot} style={{ backgroundColor: s.color }} />
                    <Text size="2" style={{ flex: 1 }}>
                      {s.name}
                    </Text>
                    <Text size="2" weight="medium">
                      ${s.total.toFixed(2)}
                    </Text>
                    <Text size="1" color="gray" style={{ width: 48, textAlign: 'right' }}>
                      {s.percentage}%
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </>
          ) : (
            <Flex direction="column" align="center" gap="2" py="6">
              <PieChart size={32} />
              <Text color="gray">No spending data yet</Text>
              <Text size="2" color="gray">
                Add some expenses to see your spending breakdown
              </Text>
            </Flex>
          )}
        </Box>
      )}

      {tab === 'list' && (
        <>
          {loading ? (
            <Text color="gray">Loading...</Text>
          ) : (
            <Flex direction="column" gap="2">
              {parents.map((parent) => {
                const children = getChildren(parent.id)
                const isExpanded = expanded.has(parent.id)

                return (
                  <Card key={parent.id} className={styles.card}>
                    <Flex
                      align="center"
                      gap="3"
                      className={styles.parentRow}
                      onClick={() => children.length > 0 && toggleExpand(parent.id)}
                    >
                      <Box className={styles.colorDot} style={{ backgroundColor: parent.color }} />
                      <Box style={{ flex: 1 }}>
                        <Text size="3" weight="bold">
                          {parent.name}
                        </Text>
                        <Text size="1" color="gray">
                          {parent.is_system ? 'System' : 'Custom'} &middot; {children.length}{' '}
                          subcategories
                        </Text>
                      </Box>
                      {children.length > 0 && (
                        <Box
                          className={styles.chevron}
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        >
                          <ChevronRight size={16} />
                        </Box>
                      )}
                    </Flex>

                    {isExpanded && children.length > 0 && (
                      <Flex direction="column" className={styles.childrenList}>
                        {children.map((child) => (
                          <Flex key={child.id} align="center" gap="3" className={styles.childRow}>
                            <Box
                              className={styles.colorDotSmall}
                              style={{ backgroundColor: child.color }}
                            />
                            <Text size="2">{child.name}</Text>
                            {child.is_system && (
                              <Badge size="1" color="gray">
                                System
                              </Badge>
                            )}
                          </Flex>
                        ))}
                      </Flex>
                    )}
                  </Card>
                )
              })}

              {parents.length === 0 && (
                <Flex direction="column" align="center" gap="2" py="6">
                  <Tags size={32} />
                  <Text color="gray">No categories yet</Text>
                </Flex>
              )}
            </Flex>
          )}
        </>
      )}
    </Box>
  )
}
