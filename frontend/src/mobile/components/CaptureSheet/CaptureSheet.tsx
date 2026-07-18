import { type JSX } from 'react'
import { Dialog, Flex, Text, Card } from '@radix-ui/themes'
import { Type, Camera } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './CaptureSheet.module.css'

// U8: the center tab button opens this sheet instead of jumping straight into the
// typed quick-add modal — Type and Scan are two distinct capture paths, not one.
// Scan stays disabled until S6 lands real document scanning (tiered Ollama/Gemini
// vision + Tesseract fallback); the receipt-OCR camera icon already inside the Type
// flow (AddTransactionModal) is a different, already-shipped feature — a raw-text
// scan that still goes through the same NL parse, not structured document extraction.
export const CaptureSheet = (): JSX.Element => {
  const { captureSheetOpen, closeCaptureSheet, openAddModal } = useBoundStore(
    useShallow((s) => ({
      captureSheetOpen: s.ui.captureSheetOpen,
      closeCaptureSheet: s.closeCaptureSheet,
      openAddModal: s.openAddModal,
    })),
  )

  const handleType = () => {
    closeCaptureSheet()
    openAddModal()
  }

  return (
    <Dialog.Root open={captureSheetOpen} onOpenChange={(open) => !open && closeCaptureSheet()}>
      <Dialog.Content
        aria-describedby={undefined}
        className={styles.sheet}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Dialog.Title className={styles.title}>Add a transaction</Dialog.Title>
        <Flex direction="column" gap="3" mt="3">
          <Card className={styles.option} onClick={handleType}>
            <Flex align="center" gap="3">
              <Flex className={styles.iconCircle} align="center" justify="center">
                <Type size={20} />
              </Flex>
              <Flex direction="column">
                <Text weight="medium">Type</Text>
                <Text size="2" color="gray">
                  Describe it in your own words
                </Text>
              </Flex>
            </Flex>
          </Card>
          <Card className={`${styles.option} ${styles.optionDisabled}`}>
            <Flex align="center" gap="3">
              <Flex className={styles.iconCircle} align="center" justify="center">
                <Camera size={20} />
              </Flex>
              <Flex direction="column">
                <Text weight="medium">Scan</Text>
                <Text size="2" color="gray">
                  Coming with document scanning
                </Text>
              </Flex>
            </Flex>
          </Card>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
