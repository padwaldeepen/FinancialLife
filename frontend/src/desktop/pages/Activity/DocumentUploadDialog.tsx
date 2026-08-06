import { useRef, type DragEvent, type JSX } from 'react'
import { Flex, Text, Dialog, Button, Spinner } from '@radix-ui/themes'
import { FileUp, Check, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { useDocumentUpload } from '../../../shared/hooks/useDocumentUpload.ts'
import toast from '../../../shared/utils/toast.ts'
import styles from './Activity.module.css'

const SPREADSHEET_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
const isSpreadsheetFile = (file: File): boolean =>
  SPREADSHEET_TYPES.has(file.type) || /\.(csv|xlsx?)$/i.test(file.name)

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // W6: a dropped .csv/.xlsx routes to the existing structured-import pipeline
  // (Activity owns the `useCsvImport` instance) instead of the OCR/Gemini document
  // pipeline below — one drop zone, two pipelines underneath depending on file type.
  onSpreadsheetFile: (file: File) => void
}

// S1: storage + upload. S3 added the single-receipt review; S4 added statement mode.
// W6: receipt-vs-statement is now auto-detected server-side from the document itself
// (no more manual picker) and upload accepts multiple files at once, each tracked
// independently in the queue below.
export const DocumentUploadDialog = ({
  open,
  onOpenChange,
  onSpreadsheetFile,
}: Props): JSX.Element => {
  const fileRef = useRef<HTMLInputElement>(null)
  const {
    dragActive,
    queue,
    setDocumentUploadDragActive,
    setDocumentUploadQueue,
    updateDocumentUploadQueueItem,
    clearDocumentUploadQueue,
  } = useBoundStore(useShallow((s) => s.documentUploadDialog))
  const { upload } = useDocumentUpload()
  const fetchPendingDocuments = useBoundStore((s) => s.documents.fetchPendingDocuments)

  const handleFiles = async (files: File[]) => {
    // Spreadsheets route to the single-file import pipeline (its column-mapping/
    // preview flow only handles one at a time); image/PDF files go through the normal
    // multi-file upload queue below. A mixed drop must not silently drop either half —
    // only the *extra* spreadsheets beyond the first are actually skipped, and that's
    // announced, not silent.
    const spreadsheets = files.filter(isSpreadsheetFile)
    const rest = files.filter((f) => !isSpreadsheetFile(f))

    if (spreadsheets.length > 1) {
      toast.error(
        `Only one spreadsheet can be imported at a time — using "${spreadsheets[0]!.name}", skipped the other ${spreadsheets.length - 1}.`,
      )
    }
    if (spreadsheets[0]) {
      onSpreadsheetFile(spreadsheets[0])
      if (rest.length === 0) {
        onOpenChange(false)
        return
      }
    }

    setDocumentUploadQueue(rest.map((f) => ({ name: f.name, size: f.size, status: 'pending' })))

    let anySucceeded = false
    for (let i = 0; i < rest.length; i++) {
      updateDocumentUploadQueueItem(i, { status: 'uploading' })
      const id = await upload(rest[i]!)
      if (id) {
        anySucceeded = true
        updateDocumentUploadQueueItem(i, { status: 'done' })
      } else {
        updateDocumentUploadQueueItem(i, { status: 'failed', error: 'Upload failed' })
      }
    }

    if (anySucceeded) fetchPendingDocuments({ force: true })
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDocumentUploadDragActive(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length) handleFiles(files)
  }

  const uploading = queue.some((q) => q.status === 'pending' || q.status === 'uploading')

  const handleClose = (nextOpen: boolean) => {
    // Closing mid-upload (Escape, outside click, or the Close button) would clear the
    // queue while `handleFiles`' loop is still awaiting `upload()` — its next
    // `updateDocumentUploadQueueItem` call would silently no-op against an empty
    // queue, and the in-flight file's outcome would never reach the user. Block the
    // dismiss instead of racing it.
    if (!nextOpen && uploading) return
    if (!nextOpen) clearDocumentUploadQueue()
    onOpenChange(nextOpen)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Upload Document</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          JPEG, PNG, PDF, CSV, or Excel — up to 15MB each. Drop several at once; each is reviewed
          separately. Receipt vs. statement is detected automatically.
        </Dialog.Description>

        {queue.length === 0 ? (
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            mt="4"
            className={styles.dropzone}
            data-active={dragActive}
            onDragOver={(e) => {
              e.preventDefault()
              setDocumentUploadDragActive(true)
            }}
            onDragLeave={() => setDocumentUploadDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <FileUp size={28} color="var(--gray-9)" />
            <Text size="2" color="gray" align="center">
              Drag files here, or click to browse
            </Text>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf,.csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length) handleFiles(files)
                e.target.value = ''
              }}
            />
          </Flex>
        ) : (
          <Flex direction="column" gap="2" mt="4" className={styles.uploadQueue}>
            {queue.map((item, i) => (
              <Flex key={`${item.name}-${i}`} align="center" justify="between" gap="2">
                <Text size="2" className={styles.uploadQueueName}>
                  {item.name}
                </Text>
                {item.status === 'uploading' && <Spinner size="1" />}
                {item.status === 'done' && <Check size={16} color="var(--green-11)" />}
                {item.status === 'failed' && (
                  <Flex align="center" gap="1">
                    <X size={16} color="var(--red-11)" />
                    <Text size="1" color="red">
                      Failed
                    </Text>
                  </Flex>
                )}
              </Flex>
            ))}
          </Flex>
        )}

        <Flex justify="end" mt="4" gap="2">
          {queue.length > 0 && !uploading && (
            <Button variant="soft" onClick={clearDocumentUploadQueue}>
              Upload more
            </Button>
          )}
          <Button
            variant="soft"
            color="gray"
            disabled={uploading}
            onClick={() => handleClose(false)}
          >
            Close
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
