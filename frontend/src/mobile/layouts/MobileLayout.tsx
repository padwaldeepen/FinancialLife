import { type JSX } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Box } from '@radix-ui/themes'
import { BottomTabBar } from '../components/BottomTabBar/BottomTabBar.tsx'
import { FAB } from '../components/FAB/FAB.tsx'
import styles from './MobileLayout.module.css'

export const MobileLayout = (): JSX.Element => {
  const navigate = useNavigate()

  return (
    <Box className={styles.layout}>
      <main className={styles.content}>
        <Outlet />
      </main>
      <FAB onClick={() => navigate('/add')} />
      <BottomTabBar />
    </Box>
  )
}
