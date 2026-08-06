import { useEffect, type JSX } from 'react'
import { Outlet } from 'react-router-dom'
import { Box } from '@radix-ui/themes'
import { useBoundStore } from '../../store/useBoundStore.ts'
import { AddTransactionModal } from '../components/AddTransactionModal/AddTransactionModal.tsx'
import { ChatBot } from '../components/ChatBot/ChatBot.tsx'
import { Sidebar } from '../components/Sidebar/Sidebar.tsx'
import styles from './DesktopLayout.module.css'

export const DesktopLayout = (): JSX.Element => {
  const openAddModal = useBoundStore((s) => s.ui.openAddModal)

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
      <ChatBot />
    </Box>
  )
}
