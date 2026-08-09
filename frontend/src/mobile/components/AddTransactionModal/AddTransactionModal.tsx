import { useRef, useEffect, type JSX } from 'react'
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
import toast from '../../../shared/utils/toast.ts'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency, formatDate, getCurrencySymbol } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import { useDocumentUpload } from '../../../shared/hooks/useDocumentUpload.ts'
import styles from './AddTransactionModal.module.css'

export const AddTransactionModal = (): JSX.Element => {
  const currency = useActiveCurrency()
  const {
    addModalOpen,
    closeAddModal,
    categories,
    fetchCategories,
    input,
    loading,
    parsed,
    saving,
    scanning,
    selectedCategoryId,
    manualAmount,
    setInput,
    setParsed,
    parseQuickAdd,
    saveQuickAdd,
    setScanning,
    setSelectedCategoryId,
    setManualAmount,
    resetQuickAdd,
    fetchPendingDocuments,
  } = useBoundStore(
    useShallow((s) => ({
      addModalOpen: s.ui.addModalOpen,
      closeAddModal: s.ui.closeAddModal,
      categories: s.categories.flat,
      fetchCategories: s.categories.fetchCategories,
      input: s.quickAddModal.input,
      loading: s.quickAddModal.loading,
      parsed: s.quickAddModal.parsed,
      saving: s.quickAddModal.saving,
      scanning: s.quickAddModal.scanning,
      selectedCategoryId: s.quickAddModal.selectedCategoryId,
      manualAmount: s.quickAddModal.manualAmount,
      setInput: s.quickAddModal.setQuickAddInput,
      setParsed: s.quickAddModal.setQuickAddParsed,
      parseQuickAdd: s.quickAddModal.parseQuickAdd,
      saveQuickAdd: s.quickAddModal.saveQuickAdd,
      setScanning: s.quickAddModal.setQuickAddScanning,
      setSelectedCategoryId: s.quickAddModal.setQuickAddSelectedCategoryId,
      setManualAmount: s.quickAddModal.setQuickAddManualAmount,
      resetQuickAdd: s.quickAddModal.resetQuickAddModal,
      fetchPendingDocuments: s.documents.fetchPendingDocuments,
    })),
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const amountMissing = Boolean(parsed?.missing?.includes('amount'))
  const { upload: uploadDocument } = useDocumentUpload()

  useEffect(() => {
    if (addModalOpen) {
      fetchCategories()
    }
  }, [addModalOpen, fetchCategories])

  // Same upload pipeline as Activity's "Upload Receipt" / desktop's quick-add —
  // every file (image, PDF, receipt, or statement) lands in the pending-documents
  // queue for review there, rather than a separate client-side OCR-to-form path.
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Attach an image or PDF — try a receipt, bill, or statement')
      return
    }
    setScanning(true)
    try {
      // No forced `kind`: passing 'receipt' skipped W6's server-side receipt-vs-
      // statement detection, so photographing a multi-row statement filed it as a
      // single receipt. Same fix already applied on desktop.
      const docId = await uploadDocument(file)
      if (docId) {
        fetchPendingDocuments({ force: true })
        toast.success('Document uploaded! Review it in Activity.')
        resetQuickAdd()
        closeAddModal()
      } else {
        toast.error('Failed to upload document')
      }
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
          resetQuickAdd()
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
              resetQuickAdd()
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
                  if (e.key === 'Enter') parseQuickAdd()
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
                    aria-label="Upload receipt"
                  >
                    <Camera size={16} />
                  </IconButton>
                </TextField.Slot>
              </TextField.Root>
              {/* No `capture` attribute (R3) — the OS-native picker offers both "Take
                  Photo" and "Photo Library" from one tap; forcing capture hides the
                  library option. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className={styles.hiddenInput}
                onChange={handleFileScan}
              />
              <Text size="1" color="gray">
                Try typing, or attach a receipt/PDF for review
              </Text>
            </Flex>

            <Button onClick={parseQuickAdd} loading={loading} size="3">
              {parsed ? 'Re-parse' : 'Parse'}
            </Button>

            {parsed && (
              <Card size="2">
                <Flex direction="column" gap="3">
                  <Flex align="center" justify="between">
                    <Text weight="bold" size="3">
                      {parsed.description}
                    </Text>
                    {amountMissing ? (
                      <TextField.Root
                        type="number"
                        placeholder="How much?"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        className={styles.amountInput}
                        autoFocus
                      >
                        <TextField.Slot side="left">
                          <Text size="2">{getCurrencySymbol(currency)}</Text>
                        </TextField.Slot>
                      </TextField.Root>
                    ) : (
                      <Text weight="bold" size="4">
                        {formatCurrency(parsed.amount || 0, currency)}
                      </Text>
                    )}
                  </Flex>

                  <Flex gap="2" align="center" wrap="wrap">
                    <Badge color={parsed.type === 'income' ? 'green' : 'orange'}>
                      {parsed.type}
                    </Badge>
                    {/* Y6: see the desktop tree's matching badge - the resolved date was
                        the one parsed field never shown before saving. */}
                    {parsed.date && (
                      <Badge color="gray" variant="soft" title="Date this will be recorded on">
                        {formatDate(parsed.date)}
                      </Badge>
                    )}
                    {parsed.merchant && (
                      <Badge
                        color="gray"
                        variant="soft"
                        title="Merchant — matched to an existing one if the name was close"
                      >
                        {parsed.merchant}
                      </Badge>
                    )}
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
                        <ScrollArea className={styles.categoryList}>
                          <Flex direction="column" gap="1">
                            {categories.map((cat) => (
                              <Box
                                key={cat.id}
                                className={styles.categoryItem}
                                style={
                                  {
                                    '--cat-depth': cat.depth + 1,
                                    '--cat-selected':
                                      selectedCategoryId === cat.id
                                        ? 'var(--accent-3)'
                                        : 'transparent',
                                  } as React.CSSProperties
                                }
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

                  <Button
                    onClick={saveQuickAdd}
                    loading={saving}
                    disabled={amountMissing && !manualAmount}
                    size="3"
                  >
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
