import { StrictMode, type JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './theme.tsx'
import { useMediaQuery } from './hooks/useMediaQuery.ts'
import { DesktopApp } from './desktop/DesktopApp.tsx'
import { MobileApp } from './mobile/MobileApp.tsx'
import '@radix-ui/themes/styles.css'
import './styles/index.css'

const queryClient = new QueryClient()

const AppRouter = (): JSX.Element => {
  const isMobile = useMediaQuery('(max-width: 1023px)')

  return isMobile ? <MobileApp /> : <DesktopApp />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRouter />
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
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
