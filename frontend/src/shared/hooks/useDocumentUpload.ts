import { useState } from 'react'
import api from '../api/client.ts'
import toast from '../utils/toast.ts'
import { getValidationErrorMessage } from '../../store/namespaceSlice.ts'

// Mirrors the backend's ALLOWED_CONTENT_TYPES (routers/documents.py) — client-side
// check is only a fast-fail UX nicety, the server re-validates independently.
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf'])
const MAX_SIZE_BYTES = 15 * 1024 * 1024

export type DocumentUploadKind = 'receipt' | 'statement'

export const useDocumentUpload = () => {
  const [uploading, setUploading] = useState(false)

  // Returns the created document's id on success (truthy — desktop callers that only
  // check `if (id)` keep working), or null on failure. Mobile's scan flow (S6) uses the
  // id to open review for exactly that document. `kind` is optional (W6) — omitted, the
  // backend auto-detects receipt vs. statement from the document itself; only ever
  // passed explicitly by the review dialogs' "doesn't look right" re-classify flow.
  const upload = async (file: File, kind?: DocumentUploadKind): Promise<number | null> => {
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
      if (kind) formData.append('kind', kind)
      // The shared client sets a default JSON Content-Type header; explicitly
      // unsetting it here lets the browser generate the multipart boundary itself
      // (a fixed header would otherwise send this as broken "JSON" with a file body).
      const res = await api.post('/api/documents/', formData, {
        headers: { 'Content-Type': undefined },
      })
      // Wording is deliberately kind-agnostic — `kind` is usually omitted now (W6
      // auto-detect), so the client doesn't know receipt-vs-statement until the
      // backend's response comes back; callers that show a per-item result (e.g.
      // DocumentUploadDialog's multi-file queue) read the real kind off that response.
      toast.success('Uploaded — analyzing…')
      return (res.data?.id as number) ?? null
    } catch (error) {
      toast.error(getValidationErrorMessage(error, 'Failed to upload document'))
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploading, upload }
}
