import { useEffect, type JSX } from 'react'
import { Box, Flex, Text, Card, Badge, IconButton, Select, TextField } from '@radix-ui/themes'
import { FileText, Image as ImageIcon, Trash2, Eye, Search } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Link } from 'react-router-dom'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatDate } from '../../../shared/utils/format.ts'
import { DocumentViewerDialog } from '../Activity/DocumentViewerDialog.tsx'
import styles from './Manage.module.css'
import shared from '../../styles/shared.module.css'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue.ts'

// X1: the document library. Before this existed, a document became unreachable the
// moment it was reviewed — `GET /api/documents/` hard-filtered `status = 'pending'` and
// nothing else listed the table, so the only way back to a source file was the
// paperclip on a transaction, and only for documents that became one.
//
// The review *queue* deliberately stays on Activity (`PendingReceipts`); this is the
// archive. A pending row here links there rather than re-implementing the review
// dialogs, so there's exactly one place that decides what a document becomes.
export const DocumentsTab = (): JSX.Element => {
  const {
    library,
    libraryLoading,
    libraryFilters,
    fetchLibrary,
    setLibraryFilter,
    rejectDocument,
  } = useBoundStore(
    useShallow((s) => ({
      library: s.documents.library,
      libraryLoading: s.documents.libraryLoading,
      libraryFilters: s.documents.libraryFilters,
      fetchLibrary: s.documents.fetchLibrary,
      setLibraryFilter: s.documents.setLibraryFilter,
      rejectDocument: s.documents.rejectDocument,
    })),
  )
  const { viewingId, setDocumentLibraryViewingId } = useBoundStore(
    useShallow((s) => s.documentLibrary),
  )

  // Re-fetches whenever a filter changes — the server does the filtering so a large
  // library never has to be held client-side just to narrow it. The text query is
  // debounced because this endpoint is the expensive one (it resolves each document's
  // linked transaction), and it is not staleness-gated, so an un-debounced box fired one
  // full query per keystroke.
  const debouncedQuery = useDebouncedValue(libraryFilters.q)
  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary, libraryFilters.status, libraryFilters.kind, debouncedQuery])

  const handleDelete = async (id: number) => {
    try {
      await rejectDocument(id)
    } catch {
      // toast handled in store
    }
    // `rejectDocument` only prunes the pending queue (its original caller); the library
    // is a separate list, so re-read it rather than mutating a second copy by hand.
    fetchLibrary()
  }

  return (
    <Box>
      <Flex className={shared.sectionHeader}>
        <Text as="div" className={styles.sectionTitle}>
          Documents
        </Text>
      </Flex>

      <Flex gap="2" wrap="wrap" mb="4">
        <TextField.Root
          placeholder="Search by filename…"
          value={libraryFilters.q}
          onChange={(e) => setLibraryFilter('q', e.target.value)}
          className={styles.docSearch}
          aria-label="Search documents by filename"
        >
          <TextField.Slot>
            <Search size={14} />
          </TextField.Slot>
        </TextField.Root>
        <Select.Root
          value={libraryFilters.status}
          onValueChange={(v) => setLibraryFilter('status', v as typeof libraryFilters.status)}
        >
          <Select.Trigger aria-label="Filter by status" />
          <Select.Content>
            <Select.Item value="all">All documents</Select.Item>
            <Select.Item value="pending">Needs review</Select.Item>
            <Select.Item value="processed">Processed</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root
          value={libraryFilters.kind || 'all'}
          onValueChange={(v) => setLibraryFilter('kind', v === 'all' ? '' : v)}
        >
          <Select.Trigger aria-label="Filter by document kind" />
          <Select.Content>
            <Select.Item value="all">All kinds</Select.Item>
            <Select.Item value="receipt">Receipts</Select.Item>
            <Select.Item value="statement">Statements</Select.Item>
            <Select.Item value="bill">Bills</Select.Item>
            {/* X3: files the app stores but deliberately never parses. */}
            <Select.Item value="other">Other</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {libraryLoading ? (
        <Text color="gray" size="2">
          Loading documents…
        </Text>
      ) : library.length === 0 ? (
        <Text color="gray" size="2">
          No documents match these filters
        </Text>
      ) : (
        <Card className={styles.card}>
          {library.map((doc) => (
            <Box key={doc.id} className={styles.row}>
              <Flex className={styles.labelGroup}>
                {doc.mime_type === 'application/pdf' ? (
                  <FileText size={18} />
                ) : (
                  <ImageIcon size={18} />
                )}
                <Box className={styles.labelText}>
                  <Text size="2" weight="medium">
                    {doc.original_filename ?? 'Untitled document'}
                  </Text>
                  <Flex gap="2" align="center" wrap="wrap">
                    <Badge variant="soft" color="gray">
                      {doc.kind}
                    </Badge>
                    <Text size="2" color="gray">
                      {formatDate(doc.uploaded_at)}
                    </Text>
                    {doc.status === 'pending' ? (
                      // The queue lives on Activity — send the user there instead of
                      // opening a second review surface with its own copy of the rules.
                      <Link to="/activity" className={styles.docLink}>
                        <Text size="2">Needs review</Text>
                      </Link>
                    ) : doc.linked_transaction_count > 0 ? (
                      <Text size="2" color="gray">
                        {doc.linked_transaction_count === 1
                          ? '1 transaction'
                          : `${doc.linked_transaction_count} transactions`}
                      </Text>
                    ) : (
                      <Text size="2" color="gray">
                        No transaction
                      </Text>
                    )}
                  </Flex>
                </Box>
              </Flex>
              <Flex gap="1">
                <IconButton
                  variant="ghost"
                  size="1"
                  onClick={() => setDocumentLibraryViewingId(doc.id)}
                  aria-label="View document"
                >
                  <Eye size={14} />
                </IconButton>
                <IconButton
                  variant="ghost"
                  size="1"
                  color="red"
                  onClick={() => handleDelete(doc.id)}
                  aria-label="Delete document"
                >
                  <Trash2 size={14} />
                </IconButton>
              </Flex>
            </Box>
          ))}
        </Card>
      )}

      {viewingId !== null && (
        <DocumentViewerDialog
          documentId={viewingId}
          onClose={() => setDocumentLibraryViewingId(null)}
        />
      )}
    </Box>
  )
}
