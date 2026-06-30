import { useState, useRef, useEffect, type JSX } from 'react'
import {
  Flex,
  Text,
  Button,
  TextField,
  Card,
  Badge,
  IconButton,
  Dialog,
  ScrollArea,
  Box,
  Popover,
} from '@radix-ui/themes'
import { Sparkles, Check, Camera, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import api from '../../../auth/api.ts'
import { extractTextFromImage, cleanOcrText } from '../../../utils/ocr.ts'
import styles from './AddTransactionModal.module.css'

interface ParsedResult {
  amount: number | null
  description: string
  type: string
  category: string | null
}

export const AddTransactionModal = (): JSX.Element => {
  const { addModalOpen, closeAddModal, categories, fetchCategories } = useBoundStore(
    useShallow((s) => ({
      addModalOpen: s.ui.addModalOpen,
      closeAddModal: s.closeAddModal,
      categories: s.categories.flat,
      fetchCategories: s.fetchCategories,
    })),
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)

  useEffect(() => {
    if (addModalOpen) {
      fetchCategories()
    }
  }, [addModalOpen, fetchCategories])

  const reset = () => {
    setInput('')
    setParsed(null)
    setLoading(false)
    setSaving(false)
    setScanning(false)
    setSelectedCategoryId(null)
  }

  const handleParse = async () => {
    if (!input.trim()) return
    setLoading(true)
    try {
      const response = await api.post('/api/transactions/parse', { text: input })
      setParsed(response.data)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Could not parse that text')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!parsed) return
    setSaving(true)
    try {
      await api.post('/api/transactions/quick-add', {
        text: input,
        category_id: selectedCategoryId ?? undefined,
      })
      toast.success('Transaction added!')
      reset()
      closeAddModal()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save transaction')
    } finally {
      setSaving(false)
    }
  }

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    try {
      const raw = await extractTextFromImage(file)
      const cleaned = cleanOcrText(raw)
      if (cleaned) {
        setInput(cleaned)
        setParsed(null)
        toast.success('Receipt scanned! Review the text.')
      } else {
        toast.error('Could not read any text from the image')
      }
    } catch {
      toast.error('Failed to scan receipt')
    } finally {
      setScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId)
    : null

  return (
    <Dialog.Root
      open={addModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset()
          closeAddModal()
        }
      }}
    >
      <Dialog.Content className={styles.content} aria-describedby={undefined}>
        <Flex align="center" justify="between" mb="4">
          <Dialog.Title className={styles.title}>Quick Add</Dialog.Title>
          <IconButton
            variant="ghost"
            size="2"
            onClick={() => {
              reset()
              closeAddModal()
            }}
            aria-label="Close"
          >
            <X size={20} />
          </IconButton>
        </Flex>

        <ScrollArea>
          <Flex direction="column" gap="4">
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Describe your transaction
              </Text>
              <TextField.Root
                placeholder="spent 15 on groceries"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setParsed(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleParse()
                }}
              >
                <TextField.Slot side="left">
                  <Sparkles size={16} />
                </TextField.Slot>
                <TextField.Slot side="right">
                  <IconButton
                    variant="ghost"
                    size="2"
                    onClick={() => fileInputRef.current?.click()}
                    loading={scanning}
                    aria-label="Scan receipt"
                  >
                    <Camera size={16} />
                  </IconButton>
                </TextField.Slot>
              </TextField.Root>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileScan}
              />
              <Text size="1" color="gray">
                Try typing or scan a receipt
              </Text>
            </Flex>

            <Button onClick={handleParse} loading={loading} size="3">
              {parsed ? 'Re-parse' : 'Parse'}
            </Button>

            {parsed && (
              <Card size="2">
                <Flex direction="column" gap="3">
                  <Flex align="center" justify="between">
                    <Text weight="bold" size="3">
                      {parsed.description}
                    </Text>
                    <Text weight="bold" size="4">
                      ${parsed.amount?.toFixed(2)}
                    </Text>
                  </Flex>

                  <Flex gap="2" align="center" wrap="wrap">
                    <Badge color={parsed.type === 'income' ? 'green' : 'orange'}>
                      {parsed.type}
                    </Badge>
                    <Popover.Root>
                      <Popover.Trigger>
                        <Box>
                          {selectedCategory ? (
                            <Badge color="gray" className={styles.categoryBadge}>
                              {selectedCategory.name}
                            </Badge>
                          ) : parsed.category ? (
                            <Badge color="gray" className={styles.categoryBadge}>
                              {parsed.category}
                            </Badge>
                          ) : null}
                        </Box>
                      </Popover.Trigger>
                      <Popover.Content size="1">
                        <ScrollArea style={{ maxHeight: 240 }}>
                          <Flex direction="column" gap="1">
                            {categories.map((cat) => (
                              <Box
                                key={cat.id}
                                className={styles.categoryItem}
                                style={{
                                  paddingLeft: `calc(var(--space-2) * ${cat.depth + 1})`,
                                  borderLeft: `3px solid ${cat.color}`,
                                  background:
                                    selectedCategoryId === cat.id
                                      ? 'var(--accent-3)'
                                      : 'transparent',
                                }}
                                onClick={() => {
                                  setSelectedCategoryId(cat.id)
                                }}
                              >
                                <Text size="2">{cat.name}</Text>
                              </Box>
                            ))}
                          </Flex>
                        </ScrollArea>
                      </Popover.Content>
                    </Popover.Root>
                  </Flex>

                  <Button onClick={handleSave} loading={saving} size="3">
                    <Check size={16} /> Confirm & save
                  </Button>
                </Flex>
              </Card>
            )}
          </Flex>
        </ScrollArea>
      </Dialog.Content>
    </Dialog.Root>
  )
}
