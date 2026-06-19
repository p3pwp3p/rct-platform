'use client'
import { useEffect } from 'react'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem('theme') ?? 'dark'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])
  return <>{children}</>
}
