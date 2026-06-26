import { useState, useEffect, useRef, type JSX } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  TextField,
  Select,
  Badge,
  IconButton,
} from '@radix-ui/themes'
import { Search, Trash2, ArrowDown, ArrowUp } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../utils/api.ts'
import styles from './Transactions.module.css'

interface Transaction {
  id: number
  amount: number
  description: string
  transaction_type: string
  category_id: number | null
  category_name: string | null
  category_color: string | null
  date: string
  notes: string | null
  ai_categorized: boolean
  created_at: string
}

export const Transactions = (): JSX.Element => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [hasMore, setHasMore] = useState(true)
  const offsetRef = useRef(0)
  const limit = 50

  const fetchTransactions = async (reset = false) => {
    setLoading(true)
    try {
      const offset = reset ? 0 : offsetRef.current
      const params: Record<string, string | number> = {
        skip: offset,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
      }
      if (search) params.search = search
      if (typeFilter) params.transaction_type = typeFilter

      const response = await api.get('/api/transactions/', { params })
      const data = response.data as Transaction[]

      if (reset) {
        setTransactions(data)
      } else {
        setTransactions((prev) => [...prev, ...data])
      }
      offsetRef.current = offset + data.length
      setHasMore(data.length === limit)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    offsetRef.current = 0
    fetchTransactions(true)
  }, [search, typeFilter, sortBy, sortOrder])

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/transactions/${id}`)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      toast.success('Transaction deleted')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete')
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
  }

  return (
    <Box className={styles.page}>
      <Heading size="5" mb="3">
        Transactions
      </Heading>

      <TextField.Root mb="2">
        <TextField.Slot>
          <Search size={16} />
        </TextField.Slot>
        <input
          className={styles.searchInput}
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </TextField.Root>

      <Flex gap="2" mb="3" align="center">
        <Select.Root value={typeFilter} onValueChange={setTypeFilter}>
          <Select.Trigger placeholder="All" style={{ minWidth: 100 }} />
          <Select.Content>
            <Select.Item value="">All</Select.Item>
            <Select.Item value="income">Income</Select.Item>
            <Select.Item value="expense">Expense</Select.Item>
          </Select.Content>
        </Select.Root>

        <Select.Root value={sortBy} onValueChange={setSortBy}>
          <Select.Trigger placeholder="Sort" style={{ minWidth: 100 }} />
          <Select.Content>
            <Select.Item value="date">Date</Select.Item>
            <Select.Item value="amount">Amount</Select.Item>
          </Select.Content>
        </Select.Root>

        <IconButton variant="ghost" size="2" onClick={toggleSortOrder} aria-label="Toggle order">
          {sortOrder === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
        </IconButton>
      </Flex>

      {loading && transactions.length === 0 ? (
        <Text color="gray">Loading...</Text>
      ) : transactions.length === 0 ? (
        <Flex direction="column" align="center" gap="2" py="6">
          <Text size="3" weight="medium">
            No transactions
          </Text>
          <Text size="2" color="gray">
            Add one using quick-add
          </Text>
        </Flex>
      ) : (
        <Box>
          {transactions.map((t) => (
            <Flex key={t.id} className={styles.row} align="center" justify="between">
              <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                <Text size="2" weight="medium" className={styles.description}>
                  {t.description}
                </Text>
                <Flex gap="2" align="center">
                  {t.category_name && (
                    <Badge color={(t.category_color as any) || 'gray'} size="1">
                      {t.category_name}
                    </Badge>
                  )}
                  <Text size="1" color="gray">
                    {formatDate(t.date)}
                  </Text>
                </Flex>
              </Flex>

              <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
                <Text
                  size="2"
                  weight="bold"
                  color={t.transaction_type === 'income' ? 'green' : 'red'}
                >
                  {t.transaction_type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                </Text>
                <IconButton
                  variant="ghost"
                  size="1"
                  color="red"
                  onClick={() => handleDelete(t.id)}
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </IconButton>
              </Flex>
            </Flex>
          ))}

          {hasMore && (
            <Flex justify="center" py="3">
              <Button onClick={() => fetchTransactions()} loading={loading} variant="soft" size="2">
                Load more
              </Button>
            </Flex>
          )}
        </Box>
      )}
    </Box>
  )
}
