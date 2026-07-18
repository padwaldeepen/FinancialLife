import { useEffect, useRef } from 'react'
import { useBoundStore } from '../../store/useBoundStore.ts'

// Calls verifyToken() exactly once, on the app's first mount, to resolve the
// refresh-cookie into a session before anything renders behind auth.loading.
export const useAuthBootstrap = (): void => {
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      useBoundStore.getState().verifyToken()
    }
  }, [])
}
