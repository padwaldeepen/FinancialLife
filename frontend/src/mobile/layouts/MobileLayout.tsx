import { type JSX } from 'react'
import { Outlet } from 'react-router-dom'
import { Box } from '@radix-ui/themes'
import { useBoundStore } from '../../store/useBoundStore.ts'
import { AddTransactionModal } from '../components/AddTransactionModal/AddTransactionModal.tsx'
import { BottomTabBar } from '../components/BottomTabBar/BottomTabBar.tsx'
import { FAB } from '../components/FAB/FAB.tsx'
import styles from './MobileLayout.module.css'

export const MobileLayout = (): JSX.Element => {
  const openAddModal = useBoundStore((s) => s.openAddModal)

  return (
    <Box className={styles.layout}>
      <main className={styles.content}>
        <Outlet />
      </main>
      <FAB onClick={openAddModal} />
      <BottomTabBar />
      <AddTransactionModal />
    </Box>
  )
}
