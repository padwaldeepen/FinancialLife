import { type JSX } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Flex, Spinner } from '@radix-ui/themes'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './ProtectedRoute.module.css'

export const ProtectedRoute = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const { token, loading } = useBoundStore(
    useShallow((s) => ({ token: s.auth.token, loading: s.auth.loading })),
  )
  const location = useLocation()

  if (loading) {
    return (
      <Flex align="center" justify="center" className={styles.fullPage}>
        <Spinner size="3" />
      </Flex>
    )
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
