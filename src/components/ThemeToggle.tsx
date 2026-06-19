'use client'
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('theme') ?? 'dark') as 'dark' | 'light'
    setTheme(saved)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      style={{
        width: 32, height: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: '1px solid var(--border-primary)',
        borderRadius: 6,
        cursor: 'pointer',
        color: 'var(--text-tertiary)',
        transition: 'border-color 0.15s, color 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = 'var(--accent-blue)'
        el.style.color = 'var(--accent-blue)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = 'var(--border-primary)'
        el.style.color = 'var(--text-tertiary)'
      }}
    >
      {theme === 'dark' ? (
        /* Sun icon */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        /* Moon icon */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}
