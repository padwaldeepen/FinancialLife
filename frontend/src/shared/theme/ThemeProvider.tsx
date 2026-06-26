import { type ReactNode, useEffect, type JSX } from 'react'
import { theme } from './theme.ts'

const cssVar = (path: string) => `--${path.replace(/\./g, '-')}`

function flattenTokens(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}-${key}` : key
    if (typeof value === 'string' || typeof value === 'number') {
      result[path] = String(value)
    } else if (value && typeof value === 'object') {
      Object.assign(result, flattenTokens(value as Record<string, unknown>, path))
    }
  }

  return result
}

function injectCSSVariables(root: HTMLElement, tokens: Record<string, string>) {
  for (const [path, value] of Object.entries(tokens)) {
    root.style.setProperty(cssVar(path), value)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  useEffect(() => {
    const tokens = flattenTokens(theme as unknown as Record<string, unknown>)
    injectCSSVariables(document.documentElement, tokens)
  }, [])

  return <>{children}</>
}
