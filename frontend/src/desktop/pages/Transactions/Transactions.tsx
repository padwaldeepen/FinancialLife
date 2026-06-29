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
import api from '../../../auth/api.ts'
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
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
  }

  return (
    <Box className={styles.page}>
      <Heading size="6" mb="4">
        Transactions
      </Heading>

      <Flex direction="column" gap="3" mb="4">
        <TextField.Root
          className={styles.searchInput}
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        >
          <TextField.Slot side="left">
            <Search size={16} />
          </TextField.Slot>
        </TextField.Root>

        <Flex gap="2" wrap="wrap" align="center">
          <Select.Root value={typeFilter} onValueChange={setTypeFilter}>
            <Select.Trigger placeholder="All types" />
            <Select.Content>
              <Select.Item value="">All types</Select.Item>
              <Select.Item value="income">Income</Select.Item>
              <Select.Item value="expense">Expense</Select.Item>
            </Select.Content>
          </Select.Root>

          <Select.Root value={sortBy} onValueChange={setSortBy}>
            <Select.Trigger placeholder="Sort by" />
            <Select.Content>
              <Select.Item value="date">Date</Select.Item>
              <Select.Item value="amount">Amount</Select.Item>
            </Select.Content>
          </Select.Root>

          <IconButton
            variant="ghost"
            size="2"
            onClick={toggleSortOrder}
            aria-label="Toggle sort order"
          >
            {sortOrder === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
          </IconButton>
        </Flex>
      </Flex>

      {loading && transactions.length === 0 ? (
        <Text color="gray">Loading...</Text>
      ) : transactions.length === 0 ? (
        <Flex direction="column" align="center" gap="2" py="8">
          <Text size="4" weight="medium">
            No transactions yet
          </Text>
          <Text size="2" color="gray">
            Add one using the quick-add feature
          </Text>
        </Flex>
      ) : (
        <Box>
          {transactions.map((t) => (
            <Flex key={t.id} className={styles.row} align="center" justify="between">
              <Flex direction="column" gap="1" style={{ flex: 1 }}>
                <Text size="2" weight="medium">
                  {t.description}
                </Text>
                <Flex gap="2" align="center">
                  {t.category_name && (
                    <Badge color={(t.category_color as any) || 'gray'}>{t.category_name}</Badge>
                  )}
                  <Text size="1" color="gray">
                    {formatDate(t.date)}
                  </Text>
                </Flex>
              </Flex>

              <Flex align="center" gap="3">
                <Text
                  size="3"
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
                  aria-label="Delete transaction"
                >
                  <Trash2 size={14} />
                </IconButton>
              </Flex>
            </Flex>
          ))}

          {hasMore && (
            <Flex justify="center" py="4">
              <Button onClick={() => fetchTransactions()} loading={loading} variant="soft">
                Load more
              </Button>
            </Flex>
          )}
        </Box>
      )}
    </Box>
  )
}
