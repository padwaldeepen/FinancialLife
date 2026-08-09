import { useEffect, type JSX } from 'react'
import {
  Flex,
  Text,
  Button,
  TextField,
  Card,
  Badge,
  IconButton,
  Dialog,
  Popover,
  Box,
  ScrollArea,
} from '@radix-ui/themes'
import { Sparkles, Check, Upload, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency, formatDate, getCurrencySymbol } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
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
    selectedCategoryId,
    manualAmount,
    dragActive,
    setInput,
    setParsed,
    parseQuickAdd,
    saveQuickAdd,
    setSelectedCategoryId,
    setManualAmount,
    setDragActive,
    resetQuickAdd,
    fetchAccounts,
    setUploadOpen,
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
      selectedCategoryId: s.quickAddModal.selectedCategoryId,
      manualAmount: s.quickAddModal.manualAmount,
      dragActive: s.quickAddModal.dragActive,
      setInput: s.quickAddModal.setQuickAddInput,
      setParsed: s.quickAddModal.setQuickAddParsed,
      parseQuickAdd: s.quickAddModal.parseQuickAdd,
      saveQuickAdd: s.quickAddModal.saveQuickAdd,
      setSelectedCategoryId: s.quickAddModal.setQuickAddSelectedCategoryId,
      setManualAmount: s.quickAddModal.setQuickAddManualAmount,
      setDragActive: s.quickAddModal.setQuickAddDragActive,
      resetQuickAdd: s.quickAddModal.resetQuickAddModal,
      fetchAccounts: s.accounts.fetchAccounts,
      setUploadOpen: s.documentUploadDialog.setDocumentUploadOpen,
    })),
  )
  const amountMissing = Boolean(parsed?.missing?.includes('amount'))

  useEffect(() => {
    if (addModalOpen) {
      fetchCategories()
      // Needed by the scanned-save path, which posts to a specific account. Opening
      // this modal from a page that hasn't loaded accounts would otherwise leave the
      // list empty and the save would refuse with "Create an account first".
      fetchAccounts()
    }
  }, [addModalOpen, fetchCategories, fetchAccounts])

  // Quick Add does not implement uploading — it hands off to the one upload dialog the
  // app has (rendered by DesktopLayout, also opened by Activity's "Upload Receipt").
  // An earlier version scanned inline and filled this card instead; that meant two
  // upload implementations, and the file/folder queue, progress and triage that make
  // the real dialog useful existed in only one of them.
  const openUpload = () => {
    resetQuickAdd()
    closeAddModal()
    setUploadOpen(true)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    openUpload()
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
      <Dialog.Content
        aria-describedby={undefined}
        className={styles.dialogContent}
        onDragOver={(e) => {
          e.preventDefault()
          if (!dragActive) setDragActive(true)
        }}
        onDragLeave={(e) => {
          // Radix Dialog.Content is one element with children — a dragleave fires when
          // crossing onto any child, not just when actually leaving the dialog.
          // relatedTarget is null at the true window boundary; the null check is what
          // filtered the false-positives that made this flicker before.
          if (!e.relatedTarget) setDragActive(false)
        }}
        onDrop={handleDrop}
      >
        {dragActive && (
          <Flex className={styles.dropOverlay} direction="column" align="center" gap="2">
            <Upload size={28} color="var(--accent-9)" />
            <Text size="2" weight="medium" color="gray">
              Drop to scan receipt or statement
            </Text>
          </Flex>
        )}
        <Flex align="center" justify="between" mb="4">
          <Dialog.Title>Quick Add</Dialog.Title>
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
            </TextField.Root>
            <Text size="1" color="gray">
              Try: &ldquo;spent 15 on groceries&rdquo;, &ldquo;uber 15&rdquo;, &ldquo;salary
              5000&rdquo; — or drop a file here to open the document uploader
            </Text>
          </Flex>

          <Flex gap="3" justify="end">
            <Button variant="soft" color="gray" onClick={openUpload} size="3">
              <Upload size={16} /> Upload a document
            </Button>
            <Button onClick={parseQuickAdd} loading={loading} size="3">
              {parsed ? 'Re-parse' : 'Parse'}
            </Button>
            {parsed && (
              <Button
                onClick={saveQuickAdd}
                loading={saving}
                disabled={amountMissing && !manualAmount}
                size="3"
              >
                <Check size={16} /> Confirm & save
              </Button>
            )}
          </Flex>

          {parsed && (
            <Card size="3">
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

                <Flex gap="2" align="center">
                  <Badge color={parsed.type === 'income' ? 'green' : 'orange'}>{parsed.type}</Badge>
                  {/* Y6: amount, merchant and category were all previewed before saving
                      but the date silently wasn't, so a relative phrase ("yesterday",
                      "last friday") couldn't be checked until after the transaction
                      existed. */}
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
              </Flex>
            </Card>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
