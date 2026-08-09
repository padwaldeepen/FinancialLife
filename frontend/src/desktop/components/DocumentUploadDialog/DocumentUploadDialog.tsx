import { useRef, type DragEvent, type JSX } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Flex, Text, Dialog, Button, Spinner, Progress, Badge, IconButton } from '@radix-ui/themes'
import { FileUp, Check, X, RotateCw, FolderOpen, MinusCircle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { useDocumentUpload } from '../../../shared/hooks/useDocumentUpload.ts'
import toast from '../../../shared/utils/toast.ts'
import {
  MAX_FOLDER_FILES,
  collectEntries,
  collectFromInput,
  hashFile,
  triageFile,
  type TriagedFile,
} from '../../../shared/utils/folderUpload.ts'
import styles from './DocumentUploadDialog.module.css'

// How many uploads run at once. Multi-file guidance converges on 3-5: enough to hide
// per-request latency, few enough that one slow file doesn't starve the rest. The old
// code was strictly sequential, which was fine for 3 files and unusable for 200.
const CONCURRENCY = 4

// Smallest progress change worth re-rendering the queue for.
const PROGRESS_STEP_PCT = 5

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // W6: a dropped .csv/.xlsx routes to the existing structured-import pipeline
  // (Activity owns the `useCsvImport` instance) instead of the OCR/Gemini document
  // pipeline below — one drop zone, two pipelines underneath depending on file type.
  onSpreadsheetFile: (file: File) => void
}

// S1: storage + upload. S3 added the single-receipt review; S4 added statement mode.
// W6: receipt-vs-statement auto-detected server-side; multi-file upload.
// X2: whole-folder upload. Three things changed shape — files are hashed and triaged
// into a plan the user confirms *before* anything uploads; uploads run concurrently with
// real byte-level progress and per-file retry; and the batch reports what still needs
// review, because "uploaded" is not the same as "done".
export const DocumentUploadDialog = ({
  open,
  onOpenChange,
  onSpreadsheetFile,
}: Props): JSX.Element => {
  // This dialog is rendered by the layout, so it can open over any page. "Review these"
  // means Activity — which is only "this page" when you happen to be on it.
  const navigate = useNavigate()
  const onActivity = useLocation().pathname === '/activity'

  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  // File objects live outside the store: the queue holds display state only, and Files
  // are neither serialisable nor useful in devtools. Indices are kept in step with the
  // queue, which is only ever rebuilt wholesale between batches.
  const pendingFiles = useRef<TriagedFile[]>([])

  const {
    dragActive,
    queue,
    phase,
    summary,
    setDocumentUploadDragActive,
    setDocumentUploadQueue,
    updateDocumentUploadQueueItem,
    clearDocumentUploadQueue,
    setUploadPhase,
    setTriageSummary,
    excludeQueueItem,
    checkHashes,
  } = useBoundStore(useShallow((s) => s.documentUploadDialog))
  const { upload } = useDocumentUpload()
  const fetchPendingDocuments = useBoundStore((s) => s.documents.fetchPendingDocuments)

  /** Hash + triage + ask the server what it already has, then show the plan. */
  const prepare = async (collected: { file: File; path: string }[], truncated: boolean) => {
    if (collected.length === 0) return
    setUploadPhase('scanning')

    const triaged = collected.map(({ file, path }) => triageFile(file, path))

    // Only hash what we'd actually upload — hashing a 15MB spreadsheet we're about to
    // hand to a different pipeline is wasted work.
    const uploadable = triaged.filter((t) => t.bucket === 'document' || t.bucket === 'other')
    // Hash with the same bounded concurrency the uploads use. Serially, 500 files means
    // reading and digesting up to 15MB each one after another — minutes of "Reading
    // folder…" before a single byte uploads, while the uploads that follow were already
    // deliberately parallel.
    const hashes = new Map<TriagedFile, string>()
    let hashCursor = 0
    const hashWorker = async (): Promise<void> => {
      while (hashCursor < uploadable.length) {
        const t = uploadable[hashCursor++]!
        hashes.set(t, await hashFile(t.file))
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, uploadable.length) }, hashWorker))
    const known = await checkHashes(Array.from(hashes.values()))

    const isKnown = (t: TriagedFile) => known.has(hashes.get(t) ?? '')
    const alreadyUploaded = uploadable.filter(isKnown).length

    setTriageSummary({
      document: triaged.filter((t) => t.bucket === 'document').length,
      spreadsheet: triaged.filter((t) => t.bucket === 'spreadsheet').length,
      other: triaged.filter((t) => t.bucket === 'other').length,
      skipped: triaged.filter((t) => t.bucket === 'skipped').length,
      alreadyUploaded,
      truncated,
    })

    pendingFiles.current = uploadable
    setDocumentUploadQueue(
      uploadable.map((t) => ({
        name: t.file.name,
        size: t.file.size,
        path: t.path,
        status: isKnown(t) ? ('skipped' as const) : ('pending' as const),
        note: isKnown(t) ? 'Already uploaded' : undefined,
      })),
    )

    // Spreadsheets go to the import pipeline, which handles exactly one at a time.
    const spreadsheets = triaged.filter((t) => t.bucket === 'spreadsheet')
    if (spreadsheets.length > 1) {
      toast.error(
        `Only one spreadsheet can be imported at a time — using "${spreadsheets[0]!.file.name}", skipped the other ${spreadsheets.length - 1}.`,
      )
    }
    if (spreadsheets[0]) onSpreadsheetFile(spreadsheets[0].file)

    setUploadPhase('confirm')
  }

  const uploadAt = async (i: number): Promise<boolean> => {
    const target = pendingFiles.current[i]
    if (!target) return false
    updateDocumentUploadQueueItem(i, { status: 'uploading', progress: 0, error: undefined })
    // Axios fires onUploadProgress per chunk. Each dispatch copies the whole queue array
    // and re-renders every row, so on a 500-file batch an unthrottled stream of events
    // is the single biggest source of jank in this dialog. Only publish when the bar
    // would visibly move.
    let lastPublished = -1
    const id = await upload(target.file, undefined, {
      silent: true,
      onProgress: (pct) => {
        if (pct !== 100 && pct - lastPublished < PROGRESS_STEP_PCT) return
        lastPublished = pct
        updateDocumentUploadQueueItem(i, { progress: pct })
      },
    })
    if (id) {
      updateDocumentUploadQueueItem(i, { status: 'done', progress: 100 })
      return true
    }
    updateDocumentUploadQueueItem(i, { status: 'failed', error: 'Upload failed' })
    return false
  }

  /** Upload every still-pending queue entry, `CONCURRENCY` at a time. */
  const runUploads = async () => {
    setUploadPhase('uploading')
    const indices = queue
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.status === 'pending' || item.status === 'failed')
      .map(({ i }) => i)

    let cursor = 0
    let anySucceeded = false
    const worker = async (): Promise<void> => {
      while (cursor < indices.length) {
        const ok = await uploadAt(indices[cursor++]!)
        if (ok) anySucceeded = true
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, indices.length) }, worker))
    if (anySucceeded) fetchPendingDocuments({ force: true })
    setUploadPhase('done')
  }

  const retryOne = async (index: number) => {
    if (await uploadAt(index)) fetchPendingDocuments({ force: true })
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDocumentUploadDragActive(false)
    // A dropped *folder* is invisible to `dataTransfer.files` — it only appears as an
    // entry on `dataTransfer.items`, so prefer that path and fall back for plain files.
    const items = Array.from(e.dataTransfer.items ?? [])
    const entries = items
      .map((it) => (it.kind === 'file' ? it.webkitGetAsEntry() : null))
      .filter((x): x is FileSystemEntry => x !== null)
    if (entries.length > 0) {
      const { files, truncated } = await collectEntries(entries)
      await prepare(files, truncated)
      return
    }
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length) {
      await prepare(
        files.map((f) => ({ file: f, path: f.name })),
        false,
      )
    }
  }

  const busy = phase === 'uploading' || phase === 'scanning'

  const handleClose = (nextOpen: boolean) => {
    // Closing mid-upload would clear the queue while the loop is still awaiting
    // `upload()` — its next update would silently no-op against an empty queue and the
    // in-flight file's outcome would never reach the user. Block the dismiss instead.
    if (!nextOpen && busy) return
    if (!nextOpen) {
      pendingFiles.current = []
      clearDocumentUploadQueue()
    }
    onOpenChange(nextOpen)
  }

  const reset = () => {
    pendingFiles.current = []
    clearDocumentUploadQueue()
  }

  const doneCount = queue.filter((q) => q.status === 'done').length
  const failedCount = queue.filter((q) => q.status === 'failed').length
  const uploadableCount = queue.filter((q) => q.status !== 'skipped').length

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>Upload Documents</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          Drop files or a whole folder. Images, PDF, CSV, Excel, or text/Word — up to 15MB each.
          Receipt vs. statement is detected automatically, and anything we can&apos;t read is filed
          under Documents rather than rejected.
        </Dialog.Description>

        {phase === 'idle' && (
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
          >
            <FileUp size={28} color="var(--gray-9)" />
            <Text size="2" color="gray" align="center">
              Drag files or a folder here
            </Text>
            <Flex gap="2">
              <Button variant="soft" size="1" onClick={() => fileRef.current?.click()}>
                Choose files
              </Button>
              <Button variant="soft" size="1" onClick={() => folderRef.current?.click()}>
                <FolderOpen size={14} /> Choose folder
              </Button>
            </Flex>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf,.csv,.xlsx,.xls,.txt,.doc,.docx"
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length) {
                  prepare(
                    files.map((f) => ({ file: f, path: f.name })),
                    false,
                  )
                }
                e.target.value = ''
              }}
            />
            <input
              ref={folderRef}
              type="file"
              multiple
              // Non-standard but universally supported; not in React's JSX prop types,
              // hence the spread.
              {...{ webkitdirectory: '', directory: '' }}
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.length) {
                  const { files, truncated } = collectFromInput(e.target.files)
                  prepare(files, truncated)
                }
                e.target.value = ''
              }}
            />
          </Flex>
        )}

        {phase === 'scanning' && (
          <Flex align="center" gap="2" mt="4">
            <Spinner size="2" />
            <Text size="2" color="gray">
              Reading folder and checking for files you already have…
            </Text>
          </Flex>
        )}

        {/* The plan, shown before a single byte uploads. */}
        {summary && phase !== 'idle' && phase !== 'scanning' && (
          <Flex direction="column" gap="1" mt="4">
            <Flex gap="2" wrap="wrap">
              {summary.document > 0 && (
                <Badge color="gray">{summary.document} receipts / statements</Badge>
              )}
              {summary.spreadsheet > 0 && (
                <Badge color="gray">{summary.spreadsheet} spreadsheet</Badge>
              )}
              {summary.other > 0 && (
                <Badge color="gray">
                  {summary.other} other document{summary.other === 1 ? '' : 's'}
                </Badge>
              )}
              {summary.alreadyUploaded > 0 && (
                <Badge color="gray" variant="soft">
                  {summary.alreadyUploaded} already uploaded
                </Badge>
              )}
              {summary.skipped > 0 && (
                <Badge color="gray" variant="soft">
                  {summary.skipped} skipped
                </Badge>
              )}
            </Flex>
            {summary.truncated && (
              <Text size="1" color="gray">
                That folder has more than {MAX_FOLDER_FILES} files — only the first{' '}
                {MAX_FOLDER_FILES} were queued.
              </Text>
            )}
          </Flex>
        )}

        {queue.length > 0 && (
          <Flex direction="column" gap="2" mt="3" className={styles.uploadQueue}>
            {queue.map((item, i) => (
              <Flex key={`${item.path ?? item.name}-${i}`} align="center" justify="between" gap="2">
                <Flex direction="column" className={styles.uploadQueueName}>
                  <Text size="2" truncate>
                    {item.path ?? item.name}
                  </Text>
                  {item.status === 'uploading' && (
                    <Progress value={item.progress ?? 0} size="1" mt="1" />
                  )}
                  {item.note && (
                    <Text size="1" color="gray">
                      {item.note}
                    </Text>
                  )}
                </Flex>
                <Flex align="center" gap="1">
                  {item.status === 'uploading' && (
                    <Text size="1" color="gray">
                      {item.progress ?? 0}%
                    </Text>
                  )}
                  {item.status === 'done' && <Check size={16} color="var(--green-11)" />}
                  {item.status === 'skipped' && <MinusCircle size={14} color="var(--gray-9)" />}
                  {item.status === 'failed' && (
                    <>
                      <X size={16} color="var(--red-11)" />
                      <IconButton
                        size="1"
                        variant="ghost"
                        aria-label={`Retry ${item.name}`}
                        onClick={() => retryOne(i)}
                      >
                        <RotateCw size={13} />
                      </IconButton>
                      <IconButton
                        size="1"
                        variant="ghost"
                        color="gray"
                        aria-label={`Exclude ${item.name} from this upload`}
                        onClick={() => excludeQueueItem(i)}
                      >
                        <X size={13} />
                      </IconButton>
                    </>
                  )}
                </Flex>
              </Flex>
            ))}
          </Flex>
        )}

        {/* A batch isn't finished when the bytes land — it's finished when the review
            queue is empty. Say so. */}
        {phase === 'done' && (
          <Text size="2" mt="3" as="div">
            {doneCount} uploaded
            {failedCount > 0 ? ` · ${failedCount} failed` : ''} — they now need reviewing
            {onActivity ? ' on this page.' : ' in Activity.'}
          </Text>
        )}

        <Flex justify="end" mt="4" gap="2">
          {phase === 'confirm' && (
            <Button onClick={runUploads} disabled={uploadableCount === 0}>
              Upload {uploadableCount} file{uploadableCount === 1 ? '' : 's'}
            </Button>
          )}
          {phase === 'done' && !onActivity && doneCount > 0 && (
            <Button
              onClick={() => {
                handleClose(false)
                navigate('/activity')
              }}
            >
              Review now
            </Button>
          )}
          {phase === 'done' && (
            <Button variant="soft" onClick={reset}>
              Upload more
            </Button>
          )}
          <Button variant="soft" color="gray" disabled={busy} onClick={() => handleClose(false)}>
            Close
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
