import { useRef, useState, type DragEvent, type JSX } from 'react'
import { Flex, Text, Dialog, Button, SegmentedControl } from '@radix-ui/themes'
import { FileUp } from 'lucide-react'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import {
  useDocumentUpload,
  type DocumentUploadKind,
} from '../../../shared/hooks/useDocumentUpload.ts'
import styles from './Activity.module.css'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// S1: storage + upload. S3 added the single-receipt review; S4 added statement mode —
// the user picks up front which kind this is, because the two extract completely
// differently (one transaction vs. a whole list) and can't be reliably auto-told apart.
export const DocumentUploadDialog = ({ open, onOpenChange }: Props): JSX.Element => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [kind, setKind] = useState<DocumentUploadKind>('receipt')
  const { uploading, upload } = useDocumentUpload()
  const fetchPendingDocuments = useBoundStore((s) => s.fetchPendingDocuments)

  const handleFile = async (file: File) => {
    const ok = await upload(file, kind)
    if (ok) {
      fetchPendingDocuments({ force: true })
      onOpenChange(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Upload Document</Dialog.Title>
        <Text size="2" color="gray">
          JPEG, PNG, or PDF — up to 15MB
        </Text>

        <SegmentedControl.Root
          value={kind}
          onValueChange={(v) => setKind(v as DocumentUploadKind)}
          mt="3"
        >
          <SegmentedControl.Item value="receipt">Receipt / Bill</SegmentedControl.Item>
          <SegmentedControl.Item value="statement">Bank / Card Statement</SegmentedControl.Item>
        </SegmentedControl.Root>
        <Text size="1" color="gray" mt="1">
          {kind === 'statement'
            ? 'A statement with many transactions — you pick which to import.'
            : 'A single receipt or bill — becomes one transaction.'}
        </Text>

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
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileRef.current?.click()}
        >
          <FileUp size={28} color="var(--gray-9)" />
          <Text size="2" color="gray" align="center">
            {uploading ? 'Uploading…' : 'Drag a file here, or click to browse'}
          </Text>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
        </Flex>

        <Flex justify="end" mt="4">
          <Button variant="soft" color="gray" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
