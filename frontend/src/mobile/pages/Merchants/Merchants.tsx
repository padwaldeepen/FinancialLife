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
} from '@radix-ui/themes'
import { Store, Search, X, Merge, BarChart3 } from 'lucide-react'
import { ResponsiveBar } from '@nivo/bar'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Merchants.module.css'

export const Merchants = (): JSX.Element => {
  const {
    merchants,
    loading,
    detail,
    fetchMerchants,
    fetchMerchantDetail,
    toggleHidden,
    fetchSimilar,
    similarPairs,
    doMerge,
  } = useBoundStore(
    useShallow((s) => ({
      merchants: s.merchants.items,
      loading: s.merchants.loading,
      detail: s.merchants.detail,
      similarPairs: s.merchants.similarPairs,
      fetchMerchants: s.fetchMerchants,
      fetchMerchantDetail: s.fetchMerchantDetail,
      toggleHidden: s.toggleHidden,
      fetchSimilar: s.fetchSimilar,
      doMerge: s.doMerge,
    })),
  )
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)

  useEffect(() => {
    fetchMerchants()
  }, [fetchMerchants])

  useEffect(() => {
    if (selected !== null) {
      fetchMerchantDetail(selected)
    }
  }, [selected, fetchMerchantDetail])

  const openDetail = (id: number) => {
    setSelected(id)
  }

  const handleToggleHidden = async (id: number, current: boolean) => {
    try {
      await toggleHidden(id, current)
      toast.success(current ? 'Merchant unhidden' : 'Merchant hidden')
    } catch {
      toast.error('Failed to update merchant')
    }
  }

  const handleFetchSimilar = async () => {
    try {
      await fetchSimilar()
      setMergeDialogOpen(true)
    } catch {
      toast.error('Failed to find similar merchants')
    }
  }

  const handleMerge = async (targetId: number, sourceId: number) => {
    try {
      await doMerge(targetId, sourceId)
      toast.success('Merchants merged')
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
    return [...filtered].sort((a, b) => b.total_spent - a.total_spent)
  }, [merchants, search])

  if (loading) {
    return <Text color="gray">Loading...</Text>
  }

  return (
    <Box className={styles.page}>
      <Flex justify="between" align="center" mb="3">
        <Heading size="5">Merchants</Heading>
        <IconButton variant="soft" size="2" onClick={handleFetchSimilar}>
          <Merge size={16} />
        </IconButton>
      </Flex>

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

      <Flex direction="column" gap="2" mt="3">
        {sorted.map((merchant) => (
          <Card key={merchant.id} className={styles.card} onClick={() => openDetail(merchant.id)}>
            <Flex align="center" gap="3">
              <Box className={styles.icon}>
                <Store size={18} />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text size="2" weight="bold">
                  {merchant.name}
                </Text>
                <Text size="1" color="gray">
                  {merchant.transaction_count} transaction
                  {merchant.transaction_count !== 1 ? 's' : ''}
                  {merchant.is_hidden && (
                    <Badge size="1" color="gray" ml="1">
                      Hidden
                    </Badge>
                  )}
                </Text>
              </Box>
              <Text size="2" weight="bold" color="red">
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

      <Dialog.Root
        open={!!selected && !!detail}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <Dialog.Content style={{ maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }}>
          {selected && detail && (
            <>
              <Dialog.Title>{detail.name}</Dialog.Title>

              <Flex direction="column" gap="3" mb="4">
                <Flex justify="between">
                  <Box>
                    <Text size="1" color="gray">
                      Total Spent
                    </Text>
                    <Text size="4" weight="bold" color="red">
                      ${detail.total_spent.toFixed(2)}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="1" color="gray">
                      Transactions
                    </Text>
                    <Text size="4" weight="bold">
                      {detail.transaction_count}
                    </Text>
                  </Box>
                </Flex>
                <Flex justify="between">
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
              </Flex>

              <Tabs.Root defaultValue="spending">
                <Tabs.List>
                  <Tabs.Trigger value="spending">
                    <BarChart3 size={14} /> Spending
                  </Tabs.Trigger>
                  <Tabs.Trigger value="categories">Categories</Tabs.Trigger>
                  <Tabs.Trigger value="history">History</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="spending" pt="3">
                  {detail.monthly_spending.length > 0 ? (
                    <Box style={{ height: 200 }}>
                      <ResponsiveBar
                        data={detail.monthly_spending}
                        keys={['amount']}
                        indexBy="month"
                        margin={{ top: 10, right: 10, bottom: 40, left: 50 }}
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
                    <Flex direction="column" gap="2">
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
                        <Flex key={tx.id} direction="column" className={styles.txRow}>
                          <Flex justify="between" align="center">
                            <Text size="2">{tx.description}</Text>
                            <Text
                              size="2"
                              weight="bold"
                              color={tx.transaction_type === 'expense' ? 'red' : 'green'}
                            >
                              {tx.transaction_type === 'expense' ? '-' : '+'}${tx.amount.toFixed(2)}
                            </Text>
                          </Flex>
                          <Text size="1" color="gray">
                            {new Date(tx.date).toLocaleDateString()}
                            {tx.category_name && <> &middot; {tx.category_name}</>}
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
                <Button
                  variant="soft"
                  color={detail.is_hidden ? 'green' : 'gray'}
                  onClick={() => handleToggleHidden(detail.id, detail.is_hidden)}
                >
                  {detail.is_hidden ? 'Unhide' : 'Hide'}
                </Button>
              </Flex>
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <Dialog.Content style={{ maxWidth: '95vw' }}>
          <Dialog.Title>Merge Duplicates</Dialog.Title>
          {similarPairs.length === 0 ? (
            <Text color="gray">No similar merchants found</Text>
          ) : (
            <Flex direction="column" gap="3">
              {similarPairs.map((pair, i) => (
                <Card key={i}>
                  <Flex direction="column" gap="2">
                    <Flex justify="between" align="center">
                      <Text size="2" weight="bold">
                        {pair.merchant_a.name}
                      </Text>
                      <Text size="1" color="gray">
                        {Math.round(pair.similarity * 100)}% match
                      </Text>
                      <Text size="2" weight="bold">
                        {pair.merchant_b.name}
                      </Text>
                    </Flex>
                    <Flex gap="2">
                      <Button
                        size="1"
                        variant="soft"
                        style={{ flex: 1 }}
                        onClick={() => handleMerge(pair.merchant_a.id, pair.merchant_b.id)}
                      >
                        Keep {pair.merchant_a.name}
                      </Button>
                      <Button
                        size="1"
                        variant="soft"
                        style={{ flex: 1 }}
                        onClick={() => handleMerge(pair.merchant_b.id, pair.merchant_a.id)}
                      >
                        Keep {pair.merchant_b.name}
                      </Button>
                    </Flex>
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
