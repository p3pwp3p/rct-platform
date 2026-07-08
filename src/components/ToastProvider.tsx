'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'
type ToastItem = { id: number; msg: string; type: ToastType }

const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {})
/** 어디서든 호출: const toast = useToast(); toast('저장됐습니다') / toast('오류', 'error') */
export const useToast = () => useContext(ToastCtx)

const STYLE: Record<ToastType, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  success: { color: '#34d399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.4)',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
  error:   { color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.4)',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> },
  info:    { color: '#4db6ac', bg: 'rgba(77,182,172,0.10)',  border: 'rgba(77,182,172,0.4)',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> },
}

function ToastCard({ msg, type }: ToastItem) {
  const s = STYLE[type]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderRadius: 8,
      background: s.bg, border: `1px solid ${s.border}`, backdropFilter: 'blur(12px)',
      boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px ${s.border}`,
      minWidth: 200, maxWidth: 'min(360px, calc(100vw - 32px))',
      animation: 'toastIn 0.28s cubic-bezier(0.16,1,0.3,1)', pointerEvents: 'auto',
    }}>
      {s.icon}
      <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: s.color }}>{msg}</span>
    </div>
  )
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const show = useCallback((msg: string, type: ToastType = 'success') => {
    const id = ++idRef.current
    setItems(x => [...x, { id, msg, type }])
    setTimeout(() => setItems(x => x.filter(t => t.id !== id)), 2800)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9000, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', alignItems: 'center' }}>
        <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:translateY(0) } }`}</style>
        {items.map(t => <ToastCard key={t.id} {...t} />)}
      </div>
    </ToastCtx.Provider>
  )
}
