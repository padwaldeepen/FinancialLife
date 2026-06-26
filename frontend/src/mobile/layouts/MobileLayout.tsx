import { type JSX } from 'react'
import { Outlet } from 'react-router-dom'
import { BottomTabBar } from '../components/BottomTabBar/BottomTabBar.tsx'
import { FAB } from '../components/FAB/FAB.tsx'
import { useNavigate } from 'react-router-dom'
import styles from './MobileLayout.module.css'

export const MobileLayout = (): JSX.Element => {
  const navigate = useNavigate()

  return (
    <div className={styles.layout}>
      <main className={styles.content}>
        <Outlet />
      </main>
      <FAB onClick={() => navigate('/add')} />
      <BottomTabBar />
    </div>
  )
}
