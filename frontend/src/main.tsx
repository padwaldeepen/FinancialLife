import { StrictMode, type JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Flex, Spinner } from '@radix-ui/themes'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './theme.tsx'
import { useMediaQuery } from './hooks/useMediaQuery.ts'
import { useBoundStore } from './store/useBoundStore.ts'
import { AuthProvider } from './auth/authContext.tsx'
import appStyles from './styles/App.module.css'
import { DesktopApp } from './desktop/DesktopApp.tsx'
import { MobileApp } from './mobile/MobileApp.tsx'
import '@radix-ui/themes/styles.css'
import './styles/index.css'

const AppRouter = (): JSX.Element => {
  const loading = useBoundStore((s) => s.auth.loading)
  const isMobile = useMediaQuery('(max-width: 1023px)')

  if (loading) {
    return (
      <Flex align="center" justify="center" className={appStyles.fullPage}>
        <Spinner size="3" />
      </Flex>
    )
  }

  return <>{isMobile ? <MobileApp /> : <DesktopApp />}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
