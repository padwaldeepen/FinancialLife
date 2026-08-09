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
  // Z1: dark-first. A stored preference always wins, and an explicit OS *light*
  // preference is still respected — "dark-first" means dark is the default when the
  // user has expressed nothing, not that light is second-class. Light stays fully
  // specified (Z5 checks both), because a phone in daylight needs it.
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return !window.matchMedia('(prefers-color-scheme: light)').matches
  })

  useEffect(() => {
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => setDark((prev) => !prev)

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {/* Z1 changes, all at the token layer so no component had to be edited:
          - `radius="full"` gives the squircle-ish softness modern fintech reads as
            current. Radix caps this sensibly per component (inputs and cards stay
            rounded-rectangles, only pills go fully round), so it can't turn tables oval.
          - `panelBackground="solid"` replaces "translucent". Translucent panels sample
            whatever is behind them, which is the same legibility trap as glassmorphism —
            and with drop shadows now flattened to hairlines (W8), a translucent panel
            over content had nothing left separating it. Solid + a 1px ring is
            unambiguous in both themes.
          - Accent stays orange: it's in the logo, the favicon and every CTA, so changing
            it costs brand identity and buys nothing. Modern fintech is a dark neutral
            plus ONE confident accent — which is what this already is, minus the dark. */}
      <Theme
        accentColor="orange"
        grayColor="slate"
        appearance={dark ? 'dark' : 'light'}
        scaling="100%"
        radius="full"
        panelBackground="solid"
      >
        {children}
      </Theme>
    </ThemeContext.Provider>
  )
}
