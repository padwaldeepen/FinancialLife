import { useState, useEffect, type JSX } from 'react'
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
} from '@radix-ui/themes'
import { Store, Search, X } from 'lucide-react'
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

export const Merchants = (): JSX.Element => {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Merchant | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

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
    setDetailLoading(true)
    try {
      const res = await api.get(`/api/merchants/${merchant.id}`)
      setDetail(res.data)
    } catch {
      toast.error('Failed to load merchant detail')
    } finally {
      setDetailLoading(false)
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

  const filtered = merchants.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.normalized_name.includes(search.toLowerCase()),
  )

  if (loading) {
    return <Text color="gray">Loading...</Text>
  }

  return (
    <Box className={styles.page}>
      <Heading size="6" mb="4">
        Merchants
      </Heading>

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

      <Flex direction="column" gap="2" mt="4">
        {filtered.map((merchant) => (
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

        {filtered.length === 0 && (
          <Flex direction="column" align="center" gap="2" py="6">
            <Store size={32} />
            <Text color="gray">No merchants found</Text>
          </Flex>
        )}
      </Flex>

      <Dialog.Root open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <Dialog.Content style={{ maxWidth: 600 }}>
          {selected && (
            <>
              <Dialog.Title>{selected.name}</Dialog.Title>
              <Dialog.Description size="2" color="gray" mb="3">
                Merchant detail
              </Dialog.Description>

              {detailLoading ? (
                <Text color="gray">Loading...</Text>
              ) : detail ? (
                <>
                  <Flex gap="6" mb="4">
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

                  <Separator size="4" mb="4" />

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
              ) : null}
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
