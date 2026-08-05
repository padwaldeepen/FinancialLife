import { useRef, type JSX } from 'react'
import { Dialog, Flex, Text, Card } from '@radix-ui/themes'
import { Type, Camera } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { useDocumentUpload } from '../../../shared/hooks/useDocumentUpload.ts'
import styles from './CaptureSheet.module.css'

// U8: the center tab button opens this sheet — Type and Scan are two distinct capture
// paths. S6 wires up Scan: the camera (rear on HTTPS/localhost, gallery picker over LAN
// HTTP) → the existing S1–S3 document pipeline → mobile review sheet. The receipt-OCR
// camera icon inside the Type flow (AddTransactionModal) is a separate, older feature
// (raw text → NL parse), not this structured document extraction.
export const CaptureSheet = (): JSX.Element => {
  const fileRef = useRef<HTMLInputElement>(null)
  const { captureSheetOpen, closeCaptureSheet, openAddModal, openScanReview } = useBoundStore(
    useShallow((s) => ({
      captureSheetOpen: s.ui.captureSheetOpen,
      closeCaptureSheet: s.closeCaptureSheet,
      openAddModal: s.openAddModal,
      openScanReview: s.openScanReview,
    })),
  )
  const fetchPendingDocuments = useBoundStore((s) => s.fetchPendingDocuments)
  const { uploading, upload } = useDocumentUpload()

  const handleType = () => {
    closeCaptureSheet()
    openAddModal()
  }

  const handleScanFile = async (file: File) => {
    const docId = await upload(file, 'receipt')
    if (docId == null) return
    // Extraction runs synchronously in the upload endpoint, so the pending list already
    // has this document with its extracted fields by the time upload resolves — await
    // the refresh, then open review for exactly this document.
    await fetchPendingDocuments({ force: true })
    closeCaptureSheet()
    openScanReview(docId)
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

          <Card className={styles.option} onClick={() => !uploading && fileRef.current?.click()}>
            <Flex align="center" gap="3">
              <Flex className={styles.iconCircle} align="center" justify="center">
                <Camera size={20} />
              </Flex>
              <Flex direction="column">
                <Text weight="medium">Scan</Text>
                {/* The explainer sits on the card, visible BEFORE the tap that triggers
                    the camera-permission prompt — a purpose note raises acceptance. */}
                <Text size="2" color="gray">
                  {uploading ? 'Reading it…' : 'Snap the whole receipt — read on this device'}
                </Text>
              </Flex>
            </Flex>
          </Card>

          {/* No `capture` attribute — that would force the camera and hide the OS's
              "Choose from Library" option (R3). Without it, iOS/Android's native file
              picker offers BOTH "Take Photo" and "Photo Library" from one tap; the
              camera option itself still needs a secure context (HTTPS/localhost) to
              actually open — over plain LAN HTTP it's absent from the sheet and only
              the library option shows, which is a normal OS behavior, not a bug here. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleScanFile(file)
              e.target.value = ''
            }}
          />
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
