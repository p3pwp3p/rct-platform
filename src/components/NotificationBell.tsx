'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useApi } from '@/lib/swr'
import { useRealtime } from '@/lib/useRealtime'

type Notification = {
  id: string
  type: 'payout' | 'rank_up' | 'system'
  title: string
  body: string
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

type CompanyPopup = {
  id: string
  title: string
  body: string
  link_url: string | null
  link_label: string | null
}

const ICON: Record<Notification['type'], string> = {
  payout: '₩',
  rank_up: '★',
  system: 'ℹ',
}
const ICON_COLOR: Record<Notification['type'], string> = {
  payout: '#34d399',
  rank_up: '#fbbf24',
  system: 'var(--accent-blue)',
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data, mutate } = useApi<{ notifications: Notification[]; unread: number }>('/api/notifications')
  const items  = data?.notifications ?? []
  const unread = data?.unread ?? 0

  // 회사 공통 팝업(프로모션·공지)도 벨에 함께 표시
  const { data: popupData } = useApi<{ popups: CompanyPopup[] }>('/api/popups')
  const popups = popupData?.popups ?? []

  // 실시간: 새 알림 도착 시 즉시 반영
  useRealtime('notifications', () => { mutate() })

  // 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function markAllRead() {
    if (unread === 0) return
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''
    // 낙관적 갱신
    mutate(
      data ? { ...data, notifications: items.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })), unread: 0 } : data,
      { revalidate: false },
    )
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ all: true }),
    })
    mutate()
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) markAllRead()
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={toggle}
        aria-label={`알림${unread > 0 ? ` (읽지 않음 ${unread})` : ''}`}
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, minWidth: 15, height: 15, padding: '0 4px',
            background: '#f87171', color: '#fff', borderRadius: 8, fontSize: 9,
            fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="알림 목록"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320, maxWidth: '90vw',
            maxHeight: 420, overflowY: 'auto', zIndex: 8000,
            background: 'var(--bg-surface)', border: '1px solid var(--border-primary)',
            borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{
            padding: '12px 14px', borderBottom: '1px solid var(--border-primary)',
            fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            position: 'sticky', top: 0, background: 'var(--bg-surface)',
          }}>
            알림
          </div>

          {/* 회사 공통 팝업(공지·프로모션) */}
          {popups.map(pp => (
            <div key={`pp-${pp.id}`} style={{
              display: 'flex', gap: 10, padding: '12px 14px',
              borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-inset)',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'var(--bg-inset)', border: '1px solid #fbbf24', color: '#fbbf24',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              }}>📢</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fbbf24', border: '1px solid #fbbf24', borderRadius: 3, padding: '0 4px' }}>공지</span>
                  <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{pp.title}</span>
                </div>
                {pp.body && (
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{pp.body}</div>
                )}
                {pp.link_url && (
                  <a href={pp.link_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--accent-blue)', marginTop: 4, display: 'inline-block' }}>
                    {pp.link_label?.trim() || '자세히 보기'} →
                  </a>
                )}
              </div>
            </div>
          ))}

          {items.length === 0 && popups.length === 0 ? (
            <div style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              새 알림이 없습니다
            </div>
          ) : (
            items.map(n => (
              <div key={n.id} style={{
                display: 'flex', gap: 10, padding: '12px 14px',
                borderBottom: '1px solid var(--border-primary)',
                background: n.read_at ? 'transparent' : 'var(--accent-blue-dim)',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--bg-inset)', border: `1px solid ${ICON_COLOR[n.type]}`,
                  color: ICON_COLOR[n.type], display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                }}>
                  {ICON[n.type] ?? 'ℹ'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
