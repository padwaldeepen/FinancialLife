import { useState, useEffect, useMemo, useRef, type JSX } from 'react'
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
import { Store, Search, X, Merge, BarChart3, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { ResponsiveBar } from '@nivo/bar'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import styles from './Merchants.module.css'

const PULL_THRESHOLD = 80

export const Merchants = (): JSX.Element => {
  const {
    merchants,
    loading,
    detail,
    fetchMerchants,
    fetchMerchantDetail,
    toggleHidden,
    updateMerchant,
    deleteMerchant,
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
      updateMerchant: s.updateMerchant,
      deleteMerchant: s.deleteMerchant,
      fetchSimilar: s.fetchSimilar,
      doMerge: s.doMerge,
    })),
  )
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  useEffect(() => {
    fetchMerchants()
  }, [fetchMerchants])

  const fetchData = async () => {
    setRefreshing(true)
    await fetchMerchants()
    setRefreshing(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return
    touchStartY.current = e.touches[0]!.clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const diff = e.touches[0]!.clientY - touchStartY.current
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, PULL_THRESHOLD * 1.5))
    }
  }

  const handleTouchEnd = () => {
    if (!isPulling.current) return
    isPulling.current = false
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setPullDistance(PULL_THRESHOLD)
      fetchData()
    }
    setPullDistance(0)
  }

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

  const openRename = () => {
    if (detail) {
      setRenameName(detail.name)
      setRenameOpen(true)
    }
  }

  const handleRename = async () => {
    if (!detail || !renameName.trim()) return
    setRenaming(true)
    try {
      await updateMerchant(detail.id, { name: renameName.trim() })
      toast.success('Merchant renamed')
      setRenameOpen(false)
      fetchMerchantDetail(detail.id)
    } catch {
      toast.error('Failed to rename merchant')
    } finally {
      setRenaming(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirmId === null) return
    setDeleting(true)
    try {
      await deleteMerchant(deleteConfirmId)
      toast.success('Merchant deleted')
      setDeleteConfirmId(null)
      setSelected(null)
    } catch {
      toast.error('Failed to delete merchant')
    } finally {
      setDeleting(false)
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
    return (
      <Flex direction="column" gap="3" p="3">
        <div
          className="skeleton"
          style={{ height: 16, width: '100%', borderRadius: 'var(--radius-2)' }}
        />
        <div
          className="skeleton"
          style={{ height: 16, width: '75%', borderRadius: 'var(--radius-2)' }}
        />
        <div
          className="skeleton"
          style={{ height: 16, width: '60%', borderRadius: 'var(--radius-2)' }}
        />
        <div
          className="skeleton"
          style={{ height: 16, width: '90%', borderRadius: 'var(--radius-2)' }}
        />
      </Flex>
    )
  }

  return (
    <Box
      className={styles.page}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Box
        className={styles.pullIndicator}
        style={
          {
            '--pull-height': `${pullDistance}px`,
            '--pull-opacity': Math.min(pullDistance / PULL_THRESHOLD, 1),
          } as React.CSSProperties
        }
      >
        <RefreshCw
          size={20}
          className={
            refreshing ? styles.spinning : pullDistance >= PULL_THRESHOLD ? styles.ready : ''
          }
        />
      </Box>

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
              <Box className={styles.flex1}>
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
                {formatCurrency(merchant.total_spent)}
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
        <Dialog.Content className={styles.dialogContent}>
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
                      {formatCurrency(detail.total_spent)}
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

                <Tabs.Content value="spending" className={styles.sectionPadding}>
                  {detail.monthly_spending.length > 0 ? (
                    <Box className={styles.chartHeight200}>
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
                    <Text color="gray" className={styles.sectionPadY}>
                      No spending data
                    </Text>
                  )}
                </Tabs.Content>

                <Tabs.Content value="categories" className={styles.sectionPadding}>
                  {detail.category_breakdown.length > 0 ? (
                    <Flex direction="column" gap="2">
                      {detail.category_breakdown.map((c) => (
                        <Flex key={c.category_name} justify="between" align="center">
                          <Flex align="center" gap="2">
                            <Box
                              className={styles.categoryDot}
                              style={{ '--dot-color': c.color } as React.CSSProperties}
                            />
                            <Text size="2">{c.category_name}</Text>
                          </Flex>
                          <Text size="2">
                            {formatCurrency(c.total)} ({c.count}x)
                          </Text>
                        </Flex>
                      ))}
                    </Flex>
                  ) : (
                    <Text color="gray" className={styles.sectionPadY}>
                      No category data
                    </Text>
                  )}
                </Tabs.Content>

                <Tabs.Content value="history" className={styles.sectionPadding}>
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
                              {tx.transaction_type === 'expense' ? '-' : '+'}
                              {formatCurrency(tx.amount)}
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
                    <Text color="gray" className={styles.sectionPadY}>
                      No transactions
                    </Text>
                  )}
                </Tabs.Content>
              </Tabs.Root>

              <Separator size="4" my="4" />

              <Flex gap="2" justify="end" wrap="wrap">
                <Button variant="soft" size="1" onClick={openRename}>
                  <Pencil size={14} /> Rename
                </Button>
                <Button
                  variant="soft"
                  size="1"
                  color="red"
                  onClick={() => setDeleteConfirmId(detail.id)}
                >
                  <Trash2 size={14} /> Delete
                </Button>
                <Button
                  variant="soft"
                  size="1"
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

      {/* Rename Dialog */}
      <Dialog.Root open={renameOpen} onOpenChange={setRenameOpen}>
        <Dialog.Content className={styles.renameDialog}>
          <Dialog.Title>Rename Merchant</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <Text size="2" color="gray">
              Update the display name for this merchant.
            </Text>
            <TextField.Root
              placeholder="Merchant name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
            />
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button onClick={handleRename} disabled={renaming || !renameName.trim()}>
              {renaming ? 'Saving...' : 'Save'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root
        open={deleteConfirmId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteConfirmId(null)
        }}
      >
        <Dialog.Content className={styles.renameDialog}>
          <Dialog.Title>Delete Merchant</Dialog.Title>
          <Text size="2" mt="2">
            Are you sure? This action cannot be undone. Transactions linked to this merchant will be
            unaffected.
          </Text>
          <Flex gap="3" mt="4" justify="end">
            <Button variant="soft" color="gray" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <Dialog.Content className={styles.maxWidth95}>
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
                        className={styles.flex1}
                        onClick={() => handleMerge(pair.merchant_a.id, pair.merchant_b.id)}
                      >
                        Keep {pair.merchant_a.name}
                      </Button>
                      <Button
                        size="1"
                        variant="soft"
                        className={styles.flex1}
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
