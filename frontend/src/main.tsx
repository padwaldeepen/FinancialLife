import { StrictMode, type JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Flex, Spinner } from '@radix-ui/themes'
// Radix's base stylesheet must load before any component CSS Modules — otherwise
// ties in cascade order (e.g. `.rt-Box { display: block }` vs. a page's
// `.page { display: flex }`, both single-class selectors) are decided by import
// order instead of intent, and Radix's later-injected rule silently wins.
import '@radix-ui/themes/styles.css'
import './styles/index.css'
// Side-effect only — configures the shared axios instance's interceptors exactly
// once, before any component can issue a request.
import './shared/api/interceptors.ts'
import { ThemeProvider } from './theme.tsx'
import { useMediaQuery } from './shared/hooks/useMediaQuery.ts'
import { useAuthBootstrap } from './shared/hooks/useAuthBootstrap.ts'
import { useBoundStore } from './store/useBoundStore.ts'
import { DesktopApp } from './desktop/DesktopApp.tsx'
import { MobileApp } from './mobile/MobileApp.tsx'
import { ProfilePickPrompt } from './shared/components/ProfilePickPrompt/ProfilePickPrompt.tsx'
import { ToastHost } from './shared/components/ToastHost/ToastHost.tsx'

const AppRouter = (): JSX.Element => {
  useAuthBootstrap()
  const loading = useBoundStore((s) => s.auth.loading)
  const isMobile = useMediaQuery('(max-width: 1023px)')

  if (loading) {
    return (
      <Flex align="center" justify="center" className="fullPage">
        <Spinner size="3" />
      </Flex>
    )
  }

  return (
    <>
      {isMobile ? <MobileApp /> : <DesktopApp />}
      <ProfilePickPrompt />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AppRouter />
        <ToastHost />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
