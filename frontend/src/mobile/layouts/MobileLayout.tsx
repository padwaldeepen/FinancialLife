import { type JSX } from 'react'
import { Outlet } from 'react-router-dom'
import { Box } from '@radix-ui/themes'
import { AddTransactionModal } from '../components/AddTransactionModal/AddTransactionModal.tsx'
import { BottomTabBar } from '../components/BottomTabBar/BottomTabBar.tsx'
import { CaptureSheet } from '../components/CaptureSheet/CaptureSheet.tsx'
import styles from './MobileLayout.module.css'

export const MobileLayout = (): JSX.Element => {
  return (
    <Box className={styles.layout}>
      <main className={styles.content}>
        <Outlet />
      </main>
      <BottomTabBar />
      <CaptureSheet />
      <AddTransactionModal />
    </Box>
  )
}
