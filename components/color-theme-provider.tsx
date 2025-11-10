'use client'

import { useEffect } from 'react'

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Load color theme on mount
    const savedTheme = localStorage.getItem('fachtura-color-theme')
    const savedRadius = localStorage.getItem('fachtura-radius')

    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme)
    }

    if (savedRadius) {
      document.documentElement.style.setProperty('--radius', `${savedRadius}rem`)
    }
  }, [])

  return <>{children}</>
}

