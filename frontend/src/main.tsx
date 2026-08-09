/* eslint-disable react-refresh/only-export-components -- AppRouter is small and specific
   to this entry point; splitting it into its own file for Fast Refresh's sake isn't worth
   it here (only affects dev-time hot reload, not correctness). */
import { StrictMode, type JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Flex, Spinner } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import './styles/index.css'
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
  // ZB: tablets get the desktop tree. The old boundary (1023px) sent everything below a
  // laptop to the mobile tree, so an iPad in portrait (768) lost Recurring, Insights and
  // Manage entirely — they have no mobile counterpart. 768 is the standard tablet floor
  // and the desktop tree was verified to hold up there (see Sidebar.module.css's matching
  // media query, which must stay in step with this number or tablets lose all navigation).
  const isMobile = useMediaQuery('(max-width: 767px)')

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
