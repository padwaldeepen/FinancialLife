import { useState, useEffect, type JSX } from 'react'
import { Box, Flex, Heading, Text, Card, Badge } from '@radix-ui/themes'
import { Tags, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../auth/api.ts'
import styles from './Categories.module.css'

interface Category {
  id: number
  name: string
  color: string
  icon: string | null
  is_system: boolean
  parent_id: number | null
  children: Category[]
}

export const Categories = (): JSX.Element => {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/api/categories/')
        setCategories(response.data)
      } catch (error: any) {
        toast.error(error.response?.data?.detail || 'Failed to load categories')
      } finally {
        setLoading(false)
      }
    }
    fetchCategories()
  }, [])

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const parents = categories.filter((c) => !c.parent_id)
  const getChildren = (parentId: number) => categories.filter((c) => c.parent_id === parentId)

  if (loading) {
    return <Text color="gray">Loading...</Text>
  }

  return (
    <Box className={styles.page}>
      <Heading size="5" mb="4">
        Categories
      </Heading>

      <Flex direction="column" gap="2">
        {parents.map((parent) => {
          const children = getChildren(parent.id)
          const isExpanded = expanded.has(parent.id)

          return (
            <Card key={parent.id} size="1">
              <Flex
                align="center"
                gap="3"
                className={styles.parentRow}
                onClick={() => children.length > 0 && toggleExpand(parent.id)}
              >
                <Box className={styles.colorDot} style={{ backgroundColor: parent.color }} />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="2" weight="bold">
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
            <Tags size={24} />
            <Text color="gray">No categories yet</Text>
          </Flex>
        )}
      </Flex>
    </Box>
  )
}
