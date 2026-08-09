// X2: turning a dropped folder into a reviewed plan.
//
// Two things the browser makes awkward, both handled here so the dialog stays about UI:
//
// 1. **A dropped folder is not in `dataTransfer.files`.** Reading that gives you nothing
//    useful for a directory — you have to walk `dataTransfer.items` via the non-standard
//    but universally-supported `webkitGetAsEntry()` API, recursing through
//    `FileSystemDirectoryReader`, whose `readEntries()` returns *at most 100 entries per
//    call* and must be called repeatedly until it returns empty. Missing that detail is
//    the classic silent bug where a large folder uploads only its first 100 files.
//
// 2. **Hashing has to happen client-side** so we can ask the server "already got these?"
//    before sending a byte. `crypto.subtle` requires a secure context; localhost counts.

export const MAX_FOLDER_FILES = 500
export const MAX_FILE_BYTES = 15 * 1024 * 1024

const SPREADSHEET_RE = /\.(csv|xlsx?)$/i
export const PARSEABLE_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf'])
export const STORE_ONLY_TYPES = new Set([
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
// Some browsers report an empty `type` for files dragged from certain filesystems, so
// fall back to the extension rather than dropping the file into "unsupported".
const STORE_ONLY_RE = /\.(txt|docx?)$/i
const PARSEABLE_RE = /\.(jpe?g|png|pdf)$/i

/** Editor/OS noise that is never a financial document. */
const IGNORED_RE = /^(\.|~\$)|^(node_modules|Thumbs\.db|desktop\.ini)$/i

export type TriageBucket = 'document' | 'spreadsheet' | 'other' | 'skipped'

export interface TriagedFile {
  file: File
  /** Path relative to the dropped folder, for display — never used to build a path. */
  path: string
  bucket: TriageBucket
  /** Only set for `skipped`, so the UI can say *why* rather than silently dropping it. */
  reason?: string
}

const isSpreadsheet = (f: File): boolean =>
  SPREADSHEET_RE.test(f.name) ||
  f.type === 'text/csv' ||
  f.type === 'application/vnd.ms-excel' ||
  f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const triageFile = (file: File, path: string): TriagedFile => {
  if (file.size === 0) return { file, path, bucket: 'skipped', reason: 'Empty file' }
  if (file.size > MAX_FILE_BYTES) {
    return { file, path, bucket: 'skipped', reason: 'Over 15MB' }
  }
  if (isSpreadsheet(file)) return { file, path, bucket: 'spreadsheet' }
  if (PARSEABLE_TYPES.has(file.type) || PARSEABLE_RE.test(file.name)) {
    return { file, path, bucket: 'document' }
  }
  if (STORE_ONLY_TYPES.has(file.type) || STORE_ONLY_RE.test(file.name)) {
    return { file, path, bucket: 'other' }
  }
  return { file, path, bucket: 'skipped', reason: 'Unsupported type' }
}

/** Drain a directory reader fully — `readEntries` yields at most 100 entries per call. */
const readAllEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
  new Promise((resolve) => {
    const all: FileSystemEntry[] = []
    const next = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(all)
            return
          }
          all.push(...batch)
          next()
        },
        () => resolve(all),
      )
    }
    next()
  })

const entryToFile = (entry: FileSystemFileEntry): Promise<File | null> =>
  new Promise((resolve) =>
    entry.file(
      (f) => resolve(f),
      () => resolve(null),
    ),
  )

/**
 * Recursively collect files from dropped entries, stopping at `MAX_FOLDER_FILES`.
 * The cap is honest rather than silent — the caller reports how many were left out.
 */
export const collectEntries = async (
  entries: FileSystemEntry[],
): Promise<{ files: { file: File; path: string }[]; truncated: boolean }> => {
  const out: { file: File; path: string }[] = []
  let truncated = false

  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (out.length >= MAX_FOLDER_FILES) {
      truncated = true
      return
    }
    if (IGNORED_RE.test(entry.name)) return

    if (entry.isFile) {
      const file = await entryToFile(entry as FileSystemFileEntry)
      if (file) out.push({ file, path: prefix ? `${prefix}/${entry.name}` : entry.name })
      return
    }
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader())
    for (const child of children) {
      await walk(child, prefix ? `${prefix}/${entry.name}` : entry.name)
    }
  }

  for (const entry of entries) {
    await walk(entry, '')
  }
  return { files: out, truncated }
}

/** Files from a `webkitdirectory` input already carry their relative path. */
export const collectFromInput = (
  fileList: FileList,
): { files: { file: File; path: string }[]; truncated: boolean } => {
  const all = Array.from(fileList)
    .filter((f) => !IGNORED_RE.test(f.name))
    .map((f) => ({
      file: f,
      path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
    }))
  return { files: all.slice(0, MAX_FOLDER_FILES), truncated: all.length > MAX_FOLDER_FILES }
}

/** SHA-256 of the file's bytes — must match the backend's `hashlib.sha256(content)`. */
export const hashFile = async (file: File): Promise<string> => {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
