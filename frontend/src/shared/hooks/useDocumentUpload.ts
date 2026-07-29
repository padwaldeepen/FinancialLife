import { useState } from 'react'
import api from '../api/client.ts'
import toast from '../utils/toast.ts'

// Mirrors the backend's ALLOWED_CONTENT_TYPES (routers/documents.py) — client-side
// check is only a fast-fail UX nicety, the server re-validates independently.
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf'])
const MAX_SIZE_BYTES = 15 * 1024 * 1024

export type DocumentUploadKind = 'receipt' | 'statement'

export const useDocumentUpload = () => {
  const [uploading, setUploading] = useState(false)

  // Returns the created document's id on success (truthy — desktop callers that only
  // check `if (id)` keep working), or null on failure. Mobile's scan flow (S6) uses the
  // id to open review for exactly that document.
  const upload = async (
    file: File,
    kind: DocumentUploadKind = 'receipt',
  ): Promise<number | null> => {
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error('Only JPEG, PNG, or PDF files are accepted')
      return null
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('File exceeds the 15MB limit')
      return null
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('kind', kind)
      // The shared client sets a default JSON Content-Type header; explicitly
      // unsetting it here lets the browser generate the multipart boundary itself
      // (a fixed header would otherwise send this as broken "JSON" with a file body).
      const res = await api.post('/api/documents/', formData, {
        headers: { 'Content-Type': undefined },
      })
      toast.success(
        kind === 'statement'
          ? 'Statement uploaded — extracting transactions…'
          : 'Scanned — review the details',
      )
      return (res.data?.id as number) ?? null
    } catch (error: any) {
      // FastAPI's own 422s put an array of {type, loc, msg, input} objects in
      // `detail` (distinct from this router's hand-raised HTTPExceptions, which are
      // always a plain string) — guard against rendering that array as a toast body.
      const detail = error.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to upload document')
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploading, upload }
}
