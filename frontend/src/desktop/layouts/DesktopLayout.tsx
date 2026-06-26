import { type JSX } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar/Sidebar.tsx'
import { TopBar } from '../components/TopBar/TopBar.tsx'
import styles from './DesktopLayout.module.css'

export const DesktopLayout = (): JSX.Element => {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <TopBar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
