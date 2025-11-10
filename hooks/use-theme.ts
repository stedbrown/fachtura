'use client'

import { useEffect, useState } from 'react'

const THEME_STORAGE_KEY = 'fachtura-theme'
const RADIUS_STORAGE_KEY = 'fachtura-radius'

export type ThemeColor = 
  | 'neutral' 
  | 'slate' 
  | 'zinc' 
  | 'stone' 
  | 'gray'
  | 'blue'
  | 'green'
  | 'orange'
  | 'rose'
  | 'violet'

export type ThemeRadius = '0' | '0.3' | '0.5' | '0.75' | '1.0'

export function useTheme() {
  const [theme, setTheme] = useState<ThemeColor>('neutral')
  const [radius, setRadius] = useState<ThemeRadius>('0.5')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeColor
    const savedRadius = localStorage.getItem(RADIUS_STORAGE_KEY) as ThemeRadius
    
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
    
    if (savedRadius) {
      setRadius(savedRadius)
      document.documentElement.style.setProperty('--radius', `${savedRadius}rem`)
    }
  }, [])

  const changeTheme = (newTheme: ThemeColor) => {
    setTheme(newTheme)
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const changeRadius = (newRadius: ThemeRadius) => {
    setRadius(newRadius)
    localStorage.setItem(RADIUS_STORAGE_KEY, newRadius)
    document.documentElement.style.setProperty('--radius', `${newRadius}rem`)
  }

  return {
    theme,
    radius,
    mounted,
    changeTheme,
    changeRadius,
  }
}

