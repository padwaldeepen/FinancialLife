import { useState, useEffect, type JSX } from 'react'
import { Box, Flex, Heading, Text, Card, Badge } from '@radix-ui/themes'
import { Tags, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Categories.module.css'

export const Categories = (): JSX.Element => {
  const { tree, loading, fetchCategories } = useBoundStore(
    useShallow((s) => ({
      tree: s.categories.tree,
      loading: s.categories.loading,
      fetchCategories: s.fetchCategories,
    })),
  )
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

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

  if (loading) {
    return <Text color="gray">Loading...</Text>
  }

  return (
    <Box className={styles.page}>
      <Heading size="6" mb="5">
        Categories
      </Heading>

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
    </Box>
  )
}
