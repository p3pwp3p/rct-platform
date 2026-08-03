'use client'
import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/lib/swr'
import { supabase } from '@/lib/supabase'
import { useModalA11y } from '@/lib/useModalA11y'

/**
 * 관리자가 특정 회원에게 보낸 팝업 알림을 대시보드 진입 시 모달로 표시.
 *
 * 알림(notifications) 중 metadata.kind='admin_popup' 이면서 안 읽은 것만 띄우고,
 * 닫으면 읽음 처리한다 → 같은 글이 다시 뜨지 않는다.
 * 여러 건이면 하나씩 순서대로 보여준다.
 */
type Notification = {
  id: string
  title: string
  body: string
  metadata: { kind?: string } | null
  read_at: string | null
  created_at: string
}

export default function MemberPopups() {
  const { data, mutate } = useApi<{ notifications: Notification[] }>('/api/notifications')
  const [closedIds, setClosedIds] = useState<string[]>([])

  const queue = (data?.notifications ?? [])
    .filter(n => n.metadata?.kind === 'admin_popup' && !n.read_at && !closedIds.includes(n.id))
    // 오래된 것부터 보여줘야 순서가 자연스럽다
    .slice()
    .reverse()

  const current = queue[0] ?? null
  const remaining = queue.length

  const close = async () => {
    if (!current) return
    // 먼저 화면에서 치우고(즉각 반응), 읽음 처리는 뒤에서
    setClosedIds(ids => [...ids, current.id])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ ids: [current.id] }),
      })
      mutate()
    } catch { /* 읽음처리 실패해도 이번 세션에선 닫힌 상태 유지 */ }
  }

  const dialogRef = useRef<HTMLDivElement>(null)
  useModalA11y(dialogRef, close)

  // 팝업이 떠 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!current) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [current])

  if (!current) return null

  return (
    <div
      ref={dialogRef}
      role="dialog" aria-modal="true" aria-labelledby="member-popup-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div style={{
        width: '100%', maxWidth: 460, background: 'var(--bg-surface)',
        border: '1px solid var(--border-primary)', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(0,0,0,0.45)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--accent-blue, #4db6ac)',
          }}>공지</span>
          {remaining > 1 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              1 / {remaining}
            </span>
          )}
        </div>

        <div style={{ padding: '22px 20px 24px' }}>
          <h2 id="member-popup-title" style={{
            fontFamily: 'var(--font-main)', fontSize: 17, fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.4,
          }}>{current.title}</h2>
          {current.body && (
            <p style={{
              fontFamily: 'var(--font-main)', fontSize: 14, lineHeight: 1.75,
              color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
            }}>{current.body}</p>
          )}
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <button
            onClick={close}
            autoFocus
            style={{
              width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
              background: 'var(--accent-blue, #4db6ac)', color: '#04110f',
              fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {remaining > 1 ? '다음' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
