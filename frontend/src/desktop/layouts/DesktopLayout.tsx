import { useEffect, type JSX } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Box } from '@radix-ui/themes'
import { useBoundStore } from '../../store/useBoundStore.ts'
import { AddTransactionModal } from '../components/AddTransactionModal/AddTransactionModal.tsx'
import { ChatBot } from '../components/ChatBot/ChatBot.tsx'
import { DocumentUploadDialog } from '../components/DocumentUploadDialog/DocumentUploadDialog.tsx'
import { Sidebar } from '../components/Sidebar/Sidebar.tsx'
import styles from './DesktopLayout.module.css'

export const DesktopLayout = (): JSX.Element => {
  const openAddModal = useBoundStore((s) => s.ui.openAddModal)
  const uploadOpen = useBoundStore((s) => s.documentUploadDialog.open)
  const setUploadOpen = useBoundStore((s) => s.documentUploadDialog.setDocumentUploadOpen)
  const setSpreadsheetFile = useBoundStore(
    (s) => s.documentUploadDialog.setDocumentUploadSpreadsheetFile,
  )
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        openAddModal()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [openAddModal])

  return (
    <Box className={styles.layout}>
      <Sidebar />
      <Box className={styles.main}>
        <main className={styles.content}>
          <Outlet />
        </main>
      </Box>
      <AddTransactionModal />
      {/* One upload dialog for the whole app. It used to be rendered by Activity, which
          meant Quick Add couldn't reach it and grew a second, bespoke scan path instead.
          Lifting it here makes "upload a document" a single component with two entry
          points rather than two implementations. */}
      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSpreadsheetFile={(file) => {
          // The CSV wizard lives in Activity, so park the file and go there.
          setSpreadsheetFile(file)
          navigate('/activity')
        }}
      />
      <ChatBot />
    </Box>
  )
}
