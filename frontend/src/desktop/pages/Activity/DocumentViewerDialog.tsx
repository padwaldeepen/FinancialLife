import { useEffect, type JSX } from 'react'
import { Box, Dialog, Skeleton, VisuallyHidden } from '@radix-ui/themes'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
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
  const { imageUrl, isPdf, setDocumentViewerImageUrl, setDocumentViewerIsPdf } = useBoundStore(
    useShallow((s) => s.documentViewerDialog),
  )

  useEffect(() => {
    let objectUrl: string | null = null
    setDocumentViewerImageUrl(null)
    api
      .get(`/api/documents/${documentId}`, { responseType: 'blob' })
      .then((res) => {
        setDocumentViewerIsPdf(res.data.type === 'application/pdf')
        objectUrl = URL.createObjectURL(res.data)
        setDocumentViewerImageUrl(objectUrl)
      })
      .catch(() => toast.error('Could not load the document image'))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Source Document</Dialog.Title>
        <VisuallyHidden>
          <Dialog.Description>
            Read-only view of the original receipt or bill image
          </Dialog.Description>
        </VisuallyHidden>
        {!imageUrl ? (
          <Skeleton>
            <Box style={{ height: 300 }} />
          </Skeleton>
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
