import { type JSX } from 'react'
import { Outlet } from 'react-router-dom'
import { Box } from '@radix-ui/themes'
import { AddTransactionModal } from '../components/AddTransactionModal/AddTransactionModal.tsx'
import { Sidebar } from '../components/Sidebar/Sidebar.tsx'
import { TopBar } from '../components/TopBar/TopBar.tsx'
import styles from './DesktopLayout.module.css'

export const DesktopLayout = (): JSX.Element => {
  return (
    <Box className={styles.layout}>
      <Sidebar />
      <Box className={styles.main}>
        <TopBar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </Box>
      <AddTransactionModal />
    </Box>
  )
}
