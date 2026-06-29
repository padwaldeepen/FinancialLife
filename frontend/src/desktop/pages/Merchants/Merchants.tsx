import { useState, useEffect, useMemo, type JSX } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  Card,
  TextField,
  IconButton,
  Badge,
  Dialog,
  Separator,
  Tabs,
  Button,
  Select,
} from '@radix-ui/themes'
import { Store, Search, X, Merge, BarChart3 } from 'lucide-react'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsivePie } from '@nivo/pie'
import toast from 'react-hot-toast'
import api from '../../../auth/api.ts'
import styles from './Merchants.module.css'

interface Merchant {
  id: number
  name: string
  normalized_name: string
  aliases: string[] | null
  is_hidden: boolean
  transaction_count: number
  total_spent: number
}

interface DetailData {
  id: number
  name: string
  is_hidden: boolean
  total_spent: number
  total_income: number
  transaction_count: number
  first_transaction_date: string | null
  last_transaction_date: string | null
  category_breakdown: { category_name: string; color: string; total: number; count: number }[]
  monthly_spending: { month: string; amount: number }[]
  recent_transactions: {
    id: number
    amount: number
    description: string
    transaction_type: string
    date: string
    category_name: string | null
    category_color: string | null
  }[]
}

interface SimilarPair {
  merchant_a: { id: number; name: string; total_spent: number }
  merchant_b: { id: number; name: string; total_spent: number }
  similarity: number
}

export const Merchants = (): JSX.Element => {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Merchant | null>(null)
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [sortBy, setSortBy] = useState<'spent' | 'count' | 'name'>('spent')
  const [similarPairs, setSimilarPairs] = useState<SimilarPair[]>([])
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)

  const fetchMerchants = async () => {
    try {
      const res = await api.get('/api/merchants/')
      setMerchants(res.data)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to load merchants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMerchants()
  }, [])

  const openDetail = async (merchant: Merchant) => {
    setSelected(merchant)
    try {
      const res = await api.get(`/api/merchants/${merchant.id}`)
      setDetail(res.data)
    } catch {
      toast.error('Failed to load merchant detail')
    }
  }

  const toggleHidden = async (merchant: Merchant) => {
    try {
      await api.put(`/api/merchants/${merchant.id}`, { is_hidden: !merchant.is_hidden })
      toast.success(merchant.is_hidden ? 'Merchant unhidden' : 'Merchant hidden')
      fetchMerchants()
    } catch {
      toast.error('Failed to update merchant')
    }
  }

  const fetchSimilar = async () => {
    try {
      const res = await api.get('/api/merchants/similar/')
      setSimilarPairs(res.data)
      setMergeDialogOpen(true)
    } catch {
      toast.error('Failed to find similar merchants')
    }
  }

  const doMerge = async (targetId: number, sourceId: number) => {
    try {
      await api.post('/api/merchants/merge', { target_id: targetId, source_ids: [sourceId] })
      toast.success('Merchants merged')
      fetchMerchants()
      setMergeDialogOpen(false)
    } catch {
      toast.error('Failed to merge merchants')
    }
  }

  const sorted = useMemo(() => {
    const filtered = merchants.filter(
      (m) =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.normalized_name.includes(search.toLowerCase()),
    )
    if (sortBy === 'spent') return [...filtered].sort((a, b) => b.total_spent - a.total_spent)
    if (sortBy === 'count')
      return [...filtered].sort((a, b) => b.transaction_count - a.transaction_count)
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }, [merchants, search, sortBy])

  if (loading) {
    return <Text color="gray">Loading...</Text>
  }

  return (
    <Box className={styles.page}>
      <Flex justify="between" align="center" mb="4">
        <Heading size="6">Merchants</Heading>
        <Button variant="soft" onClick={fetchSimilar}>
          <Merge size={16} /> Find Duplicates
        </Button>
      </Flex>

      <Flex gap="3" align="center">
        <TextField.Root
          placeholder="Search merchants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        >
          <TextField.Slot side="left">
            <Search size={16} />
          </TextField.Slot>
          {search && (
            <TextField.Slot side="right">
              <IconButton size="1" variant="ghost" onClick={() => setSearch('')}>
                <X size={14} />
              </IconButton>
            </TextField.Slot>
          )}
        </TextField.Root>
        <Select.Root value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="spent">Sort by Spent</Select.Item>
            <Select.Item value="count">Sort by Count</Select.Item>
            <Select.Item value="name">Sort by Name</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      <Flex direction="column" gap="2" mt="4">
        {sorted.map((merchant) => (
          <Card key={merchant.id} className={styles.card} onClick={() => openDetail(merchant)}>
            <Flex align="center" gap="3">
              <Box className={styles.icon}>
                <Store size={18} />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text size="3" weight="bold">
                  {merchant.name}
                </Text>
                <Text size="1" color="gray">
                  {merchant.transaction_count} transaction
                  {merchant.transaction_count !== 1 ? 's' : ''}
                  {merchant.is_hidden && (
                    <Badge size="1" color="gray" ml="2">
                      Hidden
                    </Badge>
                  )}
                </Text>
              </Box>
              <Text size="3" weight="bold" color="red">
                ${merchant.total_spent.toFixed(2)}
              </Text>
            </Flex>
          </Card>
        ))}

        {sorted.length === 0 && (
          <Flex direction="column" align="center" gap="2" py="6">
            <Store size={32} />
            <Text color="gray">No merchants found</Text>
          </Flex>
        )}
      </Flex>

      <Dialog.Root open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <Dialog.Content style={{ maxWidth: 700, maxHeight: '85vh', overflowY: 'auto' }}>
          {selected && detail && (
            <>
              <Dialog.Title>{detail.name}</Dialog.Title>

              <Flex gap="6" mb="4" wrap="wrap">
                <Box>
                  <Text size="1" color="gray">
                    Total Spent
                  </Text>
                  <Text size="5" weight="bold" color="red">
                    ${detail.total_spent.toFixed(2)}
                  </Text>
                </Box>
                <Box>
                  <Text size="1" color="gray">
                    Transactions
                  </Text>
                  <Text size="5" weight="bold">
                    {detail.transaction_count}
                  </Text>
                </Box>
                <Box>
                  <Text size="1" color="gray">
                    First Transaction
                  </Text>
                  <Text size="2">
                    {detail.first_transaction_date
                      ? new Date(detail.first_transaction_date).toLocaleDateString()
                      : '-'}
                  </Text>
                </Box>
                <Box>
                  <Text size="1" color="gray">
                    Last Transaction
                  </Text>
                  <Text size="2">
                    {detail.last_transaction_date
                      ? new Date(detail.last_transaction_date).toLocaleDateString()
                      : '-'}
                  </Text>
                </Box>
              </Flex>

              {detail.total_income > 0 && (
                <Box mb="3">
                  <Text size="1" color="gray">
                    Total Income
                  </Text>
                  <Text size="3" weight="bold" color="green">
                    ${detail.total_income.toFixed(2)}
                  </Text>
                </Box>
              )}

              <Tabs.Root defaultValue="spending">
                <Tabs.List>
                  <Tabs.Trigger value="spending">
                    <BarChart3 size={14} /> Spending Over Time
                  </Tabs.Trigger>
                  <Tabs.Trigger value="categories">Category Breakdown</Tabs.Trigger>
                  <Tabs.Trigger value="history">Transaction History</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="spending" pt="3">
                  {detail.monthly_spending.length > 0 ? (
                    <Box style={{ height: 250 }}>
                      <ResponsiveBar
                        data={detail.monthly_spending}
                        keys={['amount']}
                        indexBy="month"
                        margin={{ top: 10, right: 20, bottom: 40, left: 60 }}
                        padding={0.3}
                        colors={{ scheme: 'oranges' }}
                        axisBottom={{
                          tickSize: 5,
                          tickPadding: 5,
                          tickRotation: -45,
                        }}
                        axisLeft={{
                          tickSize: 5,
                          tickPadding: 5,
                          format: (v) => `$${v}`,
                        }}
                        enableLabel={false}
                      />
                    </Box>
                  ) : (
                    <Text color="gray" py="4">
                      No spending data
                    </Text>
                  )}
                </Tabs.Content>

                <Tabs.Content value="categories" pt="3">
                  {detail.category_breakdown.length > 0 ? (
                    <Flex gap="4" direction={{ initial: 'column', sm: 'row' }}>
                      <Box style={{ height: 200, width: 200 }}>
                        <ResponsivePie
                          data={detail.category_breakdown.map((c) => ({
                            id: c.category_name,
                            value: c.total,
                            color: c.color,
                          }))}
                          margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                          innerRadius={0.5}
                          padAngle={1}
                          colors={{ datum: 'data.color' }}
                          enableArcLabels={false}
                          enableArcLinkLabels={false}
                        />
                      </Box>
                      <Flex direction="column" gap="1" style={{ flex: 1 }}>
                        {detail.category_breakdown.map((c) => (
                          <Flex key={c.category_name} justify="between" align="center">
                            <Flex align="center" gap="2">
                              <Box
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  backgroundColor: c.color,
                                }}
                              />
                              <Text size="2">{c.category_name}</Text>
                            </Flex>
                            <Text size="2">
                              ${c.total.toFixed(2)} ({c.count}x)
                            </Text>
                          </Flex>
                        ))}
                      </Flex>
                    </Flex>
                  ) : (
                    <Text color="gray" py="4">
                      No category data
                    </Text>
                  )}
                </Tabs.Content>

                <Tabs.Content value="history" pt="3">
                  {detail.recent_transactions.length > 0 ? (
                    <Flex direction="column" gap="1">
                      {detail.recent_transactions.map((tx) => (
                        <Flex key={tx.id} justify="between" align="center" className={styles.txRow}>
                          <Flex direction="column" gap="1" style={{ flex: 1 }}>
                            <Text size="2">{tx.description}</Text>
                            <Text size="1" color="gray">
                              {new Date(tx.date).toLocaleDateString()}
                              {tx.category_name && <> &middot; {tx.category_name}</>}
                            </Text>
                          </Flex>
                          <Text
                            size="2"
                            weight="bold"
                            color={tx.transaction_type === 'expense' ? 'red' : 'green'}
                          >
                            {tx.transaction_type === 'expense' ? '-' : '+'}${tx.amount.toFixed(2)}
                          </Text>
                        </Flex>
                      ))}
                    </Flex>
                  ) : (
                    <Text color="gray" py="4">
                      No transactions
                    </Text>
                  )}
                </Tabs.Content>
              </Tabs.Root>

              <Separator size="4" my="4" />

              <Flex gap="3" justify="end">
                <IconButton
                  variant="soft"
                  color={selected.is_hidden ? 'green' : 'gray'}
                  onClick={() => toggleHidden(selected)}
                >
                  {selected.is_hidden ? 'Unhide' : 'Hide'}
                </IconButton>
              </Flex>
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <Dialog.Content style={{ maxWidth: 500 }}>
          <Dialog.Title>Merge Duplicate Merchants</Dialog.Title>
          {similarPairs.length === 0 ? (
            <Text color="gray">No similar merchants found</Text>
          ) : (
            <Flex direction="column" gap="3">
              {similarPairs.map((pair, i) => (
                <Card key={i}>
                  <Flex justify="between" align="center" gap="3">
                    <Box style={{ flex: 1 }}>
                      <Text size="2" weight="bold">
                        {pair.merchant_a.name}
                      </Text>
                      <Text size="1" color="gray">
                        ${pair.merchant_a.total_spent.toFixed(2)} spent
                      </Text>
                    </Box>
                    <Text size="1" color="gray">
                      {Math.round(pair.similarity * 100)}% match
                    </Text>
                    <Box style={{ flex: 1 }}>
                      <Text size="2" weight="bold">
                        {pair.merchant_b.name}
                      </Text>
                      <Text size="1" color="gray">
                        ${pair.merchant_b.total_spent.toFixed(2)} spent
                      </Text>
                    </Box>
                  </Flex>
                  <Flex gap="2" mt="2" justify="end">
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() => doMerge(pair.merchant_a.id, pair.merchant_b.id)}
                    >
                      Merge {pair.merchant_b.name} into {pair.merchant_a.name}
                    </Button>
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() => doMerge(pair.merchant_b.id, pair.merchant_a.id)}
                    >
                      Merge {pair.merchant_a.name} into {pair.merchant_b.name}
                    </Button>
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
