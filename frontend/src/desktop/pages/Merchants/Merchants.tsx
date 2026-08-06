import { useEffect, useMemo, type JSX } from 'react'
import {
  Box,
  Flex,
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
  Skeleton,
} from '@radix-ui/themes'
import { Store, Search, X, Merge, BarChart3, Pencil, Trash2 } from 'lucide-react'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsivePie } from '@nivo/pie'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import type { MerchantSortBy } from '../../../store/slices/merchantsSlice.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import styles from './Merchants.module.css'
import shared from '../../styles/shared.module.css'
import { PageHeader } from '../../components/PageHeader/PageHeader.tsx'

export const Merchants = (): JSX.Element => {
  const currency = useActiveCurrency()
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
      fetchMerchants: s.merchants.fetchMerchants,
      fetchMerchantDetail: s.merchants.fetchMerchantDetail,
      toggleHidden: s.merchants.toggleHidden,
      updateMerchant: s.merchants.updateMerchant,
      deleteMerchant: s.merchants.deleteMerchant,
      fetchSimilar: s.merchants.fetchSimilar,
      doMerge: s.merchants.doMerge,
    })),
  )
  const {
    search,
    selected,
    sortBy,
    mergeDialogOpen,
    renameOpen,
    renameName,
    renaming,
    deleteConfirmId,
    deleting,
    setMerchantSearch,
    openMerchantDetail,
    closeMerchantDetail,
    setMerchantSortBy,
    setMerchantMergeDialogOpen,
    openMerchantRename,
    setMerchantRenameOpen,
    setMerchantRenameName,
    setMerchantRenaming,
    startMerchantDelete,
    cancelMerchantDelete,
    setMerchantDeleting,
  } = useBoundStore(useShallow((s) => s.merchantsPage))

  useEffect(() => {
    fetchMerchants()
  }, [fetchMerchants])

  useEffect(() => {
    if (selected !== null) {
      fetchMerchantDetail(selected)
    }
  }, [selected, fetchMerchantDetail])

  const openDetail = openMerchantDetail

  const handleToggleHidden = async (id: number, current: boolean) => {
    try {
      await toggleHidden(id, current)
    } catch {
      // toast handled in store
    }
  }

  const openRename = () => {
    if (detail) openMerchantRename(detail.name)
  }

  const handleRename = async () => {
    if (!detail || !renameName.trim()) return
    setMerchantRenaming(true)
    try {
      await updateMerchant(detail.id, { name: renameName.trim() })
      setMerchantRenameOpen(false)
      fetchMerchantDetail(detail.id)
    } catch {
      // toast handled in store
    } finally {
      setMerchantRenaming(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirmId === null) return
    setMerchantDeleting(true)
    try {
      await deleteMerchant(deleteConfirmId)
      cancelMerchantDelete()
      closeMerchantDetail()
    } catch {
      // toast handled in store
    } finally {
      setMerchantDeleting(false)
    }
  }

  const handleFetchSimilar = async () => {
    try {
      await fetchSimilar()
      setMerchantMergeDialogOpen(true)
    } catch {
      // toast handled in store
    }
  }

  const handleMerge = async (targetId: number, sourceId: number) => {
    try {
      await doMerge(targetId, sourceId)
      setMerchantMergeDialogOpen(false)
    } catch {
      // toast handled in store
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
    return (
      <Flex direction="column" gap="3" p="4">
        {['100%', '70%', '85%', '50%'].map((w) => (
          <Skeleton key={w}>
            <Text as="div" size="2" style={{ width: w }}>
              Placeholder merchant name
            </Text>
          </Skeleton>
        ))}
      </Flex>
    )
  }

  return (
    <Box>
      <PageHeader
        action={
          <Button variant="soft" onClick={handleFetchSimilar}>
            <Merge size={16} /> Find Duplicates
          </Button>
        }
      />

      <Flex gap="3" align="center">
        <TextField.Root
          placeholder="Search merchants..."
          value={search}
          onChange={(e) => setMerchantSearch(e.target.value)}
          className={styles.search}
        >
          <TextField.Slot side="left">
            <Search size={16} />
          </TextField.Slot>
          {search && (
            <TextField.Slot side="right">
              <IconButton size="1" variant="ghost" onClick={() => setMerchantSearch('')}>
                <X size={14} />
              </IconButton>
            </TextField.Slot>
          )}
        </TextField.Root>
        <Select.Root value={sortBy} onValueChange={(v) => setMerchantSortBy(v as MerchantSortBy)}>
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
          <Card key={merchant.id} className={styles.card} onClick={() => openDetail(merchant.id)}>
            <Flex align="center" gap="3">
              <Box className={styles.icon}>
                <Store size={18} />
              </Box>
              <Box className={styles.flex1}>
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
                {formatCurrency(merchant.total_spent, currency)}
              </Text>
            </Flex>
          </Card>
        ))}

        {sorted.length === 0 && (
          <Flex className={shared.emptyState} direction="column">
            <Store size={32} />
            <Text color="gray">No merchants found</Text>
          </Flex>
        )}
      </Flex>

      <Dialog.Root
        open={!!selected && !!detail}
        onOpenChange={(open) => !open && closeMerchantDetail()}
      >
        <Dialog.Content className={styles.dialogContent}>
          {selected && detail && (
            <>
              <Dialog.Title>{detail.name}</Dialog.Title>

              <Flex gap="6" mb="4" wrap="wrap">
                <Box>
                  <Text size="1" color="gray">
                    Total Spent
                  </Text>
                  <Text size="5" weight="bold" color="red">
                    {formatCurrency(detail.total_spent, currency)}
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
                    {formatCurrency(detail.total_income, currency)}
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

                <Tabs.Content value="spending" className={styles.sectionPadding}>
                  {detail.monthly_spending.length > 0 ? (
                    <Box className={styles.chartHeight250}>
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
                    <Text color="gray" className={styles.sectionPadY}>
                      No spending data
                    </Text>
                  )}
                </Tabs.Content>

                <Tabs.Content value="categories" className={styles.sectionPadding}>
                  {detail.category_breakdown.length > 0 ? (
                    <Flex gap="4" direction={{ initial: 'column', sm: 'row' }}>
                      <Box className={styles.chartHeight200}>
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
                      <Flex direction="column" gap="1" className={styles.flex1}>
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
                              {formatCurrency(c.total, currency)} ({c.count}x)
                            </Text>
                          </Flex>
                        ))}
                      </Flex>
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
                        <Flex key={tx.id} justify="between" align="center" className={styles.txRow}>
                          <Flex direction="column" gap="1" className={styles.flex1}>
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
                            {tx.transaction_type === 'expense' ? '-' : '+'}
                            {formatCurrency(tx.amount, currency)}
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

              <Flex gap="3" justify="end">
                <Button variant="soft" onClick={openRename}>
                  <Pencil size={14} /> Rename
                </Button>
                <Button variant="soft" color="red" onClick={() => startMerchantDelete(detail.id)}>
                  <Trash2 size={14} /> Delete
                </Button>
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

      {/* Rename Dialog */}
      <Dialog.Root open={renameOpen} onOpenChange={setMerchantRenameOpen}>
        <Dialog.Content className={styles.renameDialog}>
          <Dialog.Title>Rename Merchant</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <Text size="2" color="gray">
              Update the display name for this merchant.
            </Text>
            <TextField.Root
              placeholder="Merchant name"
              value={renameName}
              onChange={(e) => setMerchantRenameName(e.target.value)}
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
          if (!o) cancelMerchantDelete()
        }}
      >
        <Dialog.Content className={styles.renameDialog}>
          <Dialog.Title>Delete Merchant</Dialog.Title>
          <Text size="2" mt="2">
            Are you sure you want to delete this merchant? This action cannot be undone.
            Transactions linked to this merchant will be unaffected.
          </Text>
          <Flex gap="3" mt="4" justify="end">
            <Button variant="soft" color="gray" onClick={() => cancelMerchantDelete()}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={mergeDialogOpen} onOpenChange={setMerchantMergeDialogOpen}>
        <Dialog.Content className={styles.mergeDialog}>
          <Dialog.Title>Merge Duplicate Merchants</Dialog.Title>
          {similarPairs.length === 0 ? (
            <Text color="gray">No similar merchants found</Text>
          ) : (
            <Flex direction="column" gap="3">
              {similarPairs.map((pair, i) => (
                <Card key={i}>
                  <Flex justify="between" align="center" gap="3">
                    <Box className={styles.flex1}>
                      <Text size="2" weight="bold">
                        {pair.merchant_a.name}
                      </Text>
                      <Text size="1" color="gray">
                        {formatCurrency(pair.merchant_a.total_spent, currency)} spent
                      </Text>
                    </Box>
                    <Text size="1" color="gray">
                      {Math.round(pair.similarity * 100)}% match
                    </Text>
                    <Box className={styles.flex1}>
                      <Text size="2" weight="bold">
                        {pair.merchant_b.name}
                      </Text>
                      <Text size="1" color="gray">
                        {formatCurrency(pair.merchant_b.total_spent, currency)} spent
                      </Text>
                    </Box>
                  </Flex>
                  <Flex gap="2" mt="2" justify="end">
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() => handleMerge(pair.merchant_a.id, pair.merchant_b.id)}
                    >
                      Merge {pair.merchant_b.name} into {pair.merchant_a.name}
                    </Button>
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() => handleMerge(pair.merchant_b.id, pair.merchant_a.id)}
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
