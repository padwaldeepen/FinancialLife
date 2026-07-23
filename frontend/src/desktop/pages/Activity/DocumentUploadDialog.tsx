import { useRef, useState, type DragEvent, type JSX } from 'react'
import { Flex, Text, Dialog, Button } from '@radix-ui/themes'
import { FileUp } from 'lucide-react'
import { useDocumentUpload } from '../../../shared/hooks/useDocumentUpload.ts'
import styles from './Activity.module.css'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// S1: storage + upload only — no review screen yet (that's a later Phase S ticket),
// so a successful upload just confirms the file landed and is queued (status=pending).
export const DocumentUploadDialog = ({ open, onOpenChange }: Props): JSX.Element => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const { uploading, upload } = useDocumentUpload()

  const handleFile = async (file: File) => {
    const ok = await upload(file)
    if (ok) onOpenChange(false)
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
        <Dialog.Title>Upload Receipt or Bill</Dialog.Title>
        <Text size="2" color="gray">
          JPEG, PNG, or PDF — up to 15MB
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
