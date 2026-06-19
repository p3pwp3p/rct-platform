'use client'
import { useEffect, useState } from 'react'

type Popup = {
  id: string
  title: string
  body: string
  link_url: string | null
  link_label: string | null
}

// 오늘 하루 닫기 키 (localStorage)
const dismissKey = (id: string) => `popup_dismiss_${id}`
function isDismissedToday(id: string): boolean {
  const v = localStorage.getItem(dismissKey(id))
  if (!v) return false
  return v === new Date().toDateString()
}

export default function HomePopups() {
  const [popups, setPopups] = useState<Popup[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/popups')
      .then(r => r.json())
      .then((json: { popups?: Popup[] }) => {
        if (cancelled) return
        const list = (json.popups ?? []).filter(p => !isDismissedToday(p.id))
        setPopups(list)
      })
      .catch(() => { /* 팝업 실패는 무시 */ })
    return () => { cancelled = true }
  }, [])

  if (idx >= popups.length) return null
  const p = popups[idx]
  if (!p) return null

  const close = () => setIdx(i => i + 1)
  const dismissToday = () => {
    localStorage.setItem(dismissKey(p.id), new Date().toDateString())
    close()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}
      onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div style={{
        width: 400, maxWidth: '100%', background: '#11141b',
        border: '1px solid #242a35', borderRadius: 12, overflow: 'hidden',
        animation: 'popupIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <style>{`@keyframes popupIn { from { opacity:0; transform:scale(0.92) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>

        {/* 헤더 */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #242a35', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-main)', fontSize: 16, fontWeight: 700, color: '#e0e6ed', lineHeight: 1.4 }}>{p.title}</h3>
          <button onClick={close} aria-label="닫기"
            style={{ flexShrink: 0, width: 26, height: 26, border: 'none', background: 'rgba(255,255,255,0.05)', borderRadius: 5, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* 본문 */}
        {p.body && (
          <div style={{ padding: '18px 22px', fontFamily: 'var(--font-main)', fontSize: 13.5, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {p.body}
          </div>
        )}

        {/* 링크 버튼 */}
        {p.link_url && (
          <div style={{ padding: '0 22px 18px' }}>
            <a href={p.link_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 7, background: '#4db6ac', color: '#07080a', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              {p.link_label?.trim() || '자세히 보기'}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
            </a>
          </div>
        )}

        {/* 푸터 */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid #242a35', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={dismissToday}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-main)', fontSize: 12, color: '#64748b' }}>
            오늘 하루 보지 않기
          </button>
          {popups.length > 1 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748b' }}>{idx + 1} / {popups.length}</span>
          )}
        </div>
      </div>
    </div>
  )
}
