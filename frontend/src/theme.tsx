/* eslint-disable react-refresh/only-export-components -- ThemeProvider, useAppTheme, and
   ThemeContext are small and tightly coupled; splitting into 3 files for Fast Refresh's
   sake isn't worth the navigation cost here (only affects dev-time hot reload, not
   correctness). */
import { createContext, useContext, useState, useEffect, type ReactNode, type JSX } from 'react'
import { Theme } from '@radix-ui/themes'

interface ThemeContextValue {
  dark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ dark: false, toggle: () => {} })

export const useAppTheme = () => useContext(ThemeContext)

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps): JSX.Element => {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => setDark((prev) => !prev)

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      <Theme
        accentColor="orange"
        grayColor="slate"
        appearance={dark ? 'dark' : 'light'}
        scaling="100%"
        radius="large"
        panelBackground="translucent"
      >
        {children}
      </Theme>
    </ThemeContext.Provider>
  )
}
