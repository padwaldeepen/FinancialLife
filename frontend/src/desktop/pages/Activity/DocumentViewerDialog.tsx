import { useEffect, useState, type JSX } from 'react'
import { Box, Dialog } from '@radix-ui/themes'
import api from '../../../shared/api/client.ts'
import toast from '../../../shared/utils/toast.ts'

interface Props {
  documentId: number
  onClose: () => void
}

// The paperclip link on a transaction row (S3) — a read-only look at the source
// receipt/bill image. `GET /api/documents/{id}` requires the same auth headers as
// every other API call, so a plain `<img src>` can't point at it directly; fetch as a
// blob and view it via an object URL instead (same approach as DocumentReviewDialog).
export const DocumentViewerDialog = ({ documentId, onClose }: Props): JSX.Element => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    api
      .get(`/api/documents/${documentId}`, { responseType: 'blob' })
      .then((res) => {
        setIsPdf(res.data.type === 'application/pdf')
        objectUrl = URL.createObjectURL(res.data)
        setImageUrl(objectUrl)
      })
      .catch(() => toast.error('Could not load the document image'))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [documentId])

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Source Document</Dialog.Title>
        {!imageUrl ? (
          <Box className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-3)' }} />
        ) : isPdf ? (
          <object
            data={imageUrl}
            type="application/pdf"
            style={{ width: '100%', height: 500, borderRadius: 'var(--radius-3)' }}
          >
            <a href={imageUrl} target="_blank" rel="noreferrer">
              Open PDF
            </a>
          </object>
        ) : (
          <Box>
            <img
              src={imageUrl}
              alt="Source document"
              style={{ width: '100%', borderRadius: 'var(--radius-3)' }}
            />
          </Box>
        )}
      </Dialog.Content>
    </Dialog.Root>
  )
}
