import { type ReactNode, useState, type JSX } from 'react'
import { Theme } from '@radix-ui/themes'

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps): JSX.Element => {
  const [dark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')

  return (
    <Theme
      accentColor="orange"
      grayColor="slate"
      appearance={dark ? 'dark' : 'light'}
      scaling="100%"
      radius="medium"
    >
      {children}
    </Theme>
  )
}
