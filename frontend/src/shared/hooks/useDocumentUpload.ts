import { useState } from 'react'
import api from '../api/client.ts'
import toast from '../utils/toast.ts'
import { getValidationErrorMessage } from '../../store/namespaceSlice.ts'
import { MAX_FILE_BYTES, PARSEABLE_TYPES, STORE_ONLY_TYPES } from '../utils/folderUpload.ts'

// Mirrors the backend's ALLOWED_CONTENT_TYPES (routers/documents.py) — client-side
// check is only a fast-fail UX nicety, the server re-validates independently.
// Derived from the triage lists rather than restated. These were two hand-maintained
// copies of the same policy, so adding an accepted type in one place would have let the
// folder uploader triage a file that this uploader then rejected.
const ALLOWED_TYPES = new Set([...PARSEABLE_TYPES, ...STORE_ONLY_TYPES])
const MAX_SIZE_BYTES = MAX_FILE_BYTES

export type DocumentUploadKind = 'receipt' | 'statement'

export const useDocumentUpload = () => {
  const [uploading, setUploading] = useState(false)

  // Returns the created document's id on success (truthy — desktop callers that only
  // check `if (id)` keep working), or null on failure. Mobile's scan flow (S6) uses the
  // id to open review for exactly that document. `kind` is optional (W6) — omitted, the
  // backend auto-detects receipt vs. statement from the document itself; only ever
  // passed explicitly by the review dialogs' "doesn't look right" re-classify flow.
  // X2 added `opts`: byte-level progress, and `silent` for batch callers. A 40-file
  // folder drop firing 40 toasts on top of a queue that already shows per-file status is
  // noise, not feedback (flagged in W7's review and unfixed until now).
  const upload = async (
    file: File,
    kind?: DocumentUploadKind,
    opts?: { onProgress?: (pct: number) => void; silent?: boolean },
  ): Promise<number | null> => {
    if (!ALLOWED_TYPES.has(file.type)) {
      if (!opts?.silent) toast.error('Only images, PDFs, or text/Word documents are accepted')
      return null
    }
    if (file.size > MAX_SIZE_BYTES) {
      if (!opts?.silent) toast.error('File exceeds the 15MB limit')
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
        // X2: real byte-level progress. Without this the queue could only show four
        // discrete states, so a large file looked identical to a hung one.
        onUploadProgress: opts?.onProgress
          ? (e) => {
              // `total` is absent on some proxies; report indeterminate rather than
              // dividing by undefined and rendering NaN%.
              if (e.total) opts.onProgress?.(Math.round((e.loaded / e.total) * 100))
            }
          : undefined,
      })
      // Wording is deliberately kind-agnostic — `kind` is usually omitted now (W6
      // auto-detect), so the client doesn't know receipt-vs-statement until the
      // backend's response comes back; callers that show a per-item result (e.g.
      // DocumentUploadDialog's multi-file queue) read the real kind off that response.
      // X3: a store-only document was never "analyzed", so saying so would be a lie.
      // The backend is the authority on what kind it landed as.
      const uploadedKind = res.data?.kind as string | undefined
      if (!opts?.silent) {
        toast.success(
          uploadedKind === 'other'
            ? 'Saved to documents — not a receipt or statement'
            : 'Uploaded — analyzing…',
        )
      }
      return (res.data?.id as number) ?? null
    } catch (error) {
      if (!opts?.silent) toast.error(getValidationErrorMessage(error, 'Failed to upload document'))
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploading, upload }
}
