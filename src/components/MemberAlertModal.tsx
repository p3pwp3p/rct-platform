'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Alert = {
  nodeId: string
  name: string | null
  kind: 'pending_suspend' | 'suspended'
  graceUntil: string | null
  reason: string | null
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return ms <= 0 ? 0 : Math.ceil(ms / 86400_000)
}

/**
 * 로그인 시 본인 노드에 "정지 예정 / 정지됨"이 있으면 중앙 모달로 안내.
 * 확인을 누르면 이번 세션 동안 닫힘(sessionStorage). 상태가 남아있으면 다음 로그인에 다시 뜸.
 */
export default function MemberAlertModal() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      try {
        const res = await fetch('/api/member-alerts', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (cancelled) return
        setAlerts(json.alerts ?? [])
      } catch { /* 무시 */ }
    })()
    return () => { cancelled = true }
  }, [])

  if (closed || alerts.length === 0) return null

  // 확인을 누르면 이번 화면에서만 닫힘. 로그인/새로고침하면 상태가 남아있는 한 다시 뜬다.
  const close = () => setClosed(true)

  const hasSuspended = alerts.some(a => a.kind === 'suspended')
  const accent = hasSuspended ? '#f87171' : '#fbbf24'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        width: 420, maxWidth: '100%', background: 'var(--bg-surface)',
        border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden',
        borderTop: `3px solid ${accent}`,
        fontFamily: 'var(--font-main)',
      }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: `${accent}1a`, border: `1px solid ${accent}`, color: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700,
          }}>!</div>
          <h3 style={{ fontFamily: 'var(--font-main)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {hasSuspended ? '노드 정지 안내' : '노드 정지 예정 안내'}
          </h3>
        </div>

        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map(a => {
            const d = daysLeft(a.graceUntil)
            return (
              <div key={a.nodeId} style={{
                padding: '12px 14px', borderRadius: 8, background: 'var(--bg-inset)',
                border: '1px solid var(--border-primary)',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: accent, fontWeight: 700 }}>
                  {a.nodeId} {a.name ? `· ${a.name}` : ''}
                </div>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                  {a.kind === 'suspended'
                    ? '증거금 미충족으로 정지된 상태입니다. 증거금을 3,000$ 이상으로 보충하면 자동 해제됩니다.'
                    : <>증거금 부족으로 <b style={{ color: accent }}>{d ?? 0}일 후 정지</b> 예정입니다. 그 전에 증거금을 3,000$ 이상으로 보충하세요.</>}
                </div>
                {a.reason && (
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>사유: {a.reason}</div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ padding: '12px 22px 18px' }}>
          <button onClick={close} style={{
            width: '100%', padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--accent-blue)', color: '#07080a', fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 700,
          }}>확인</button>
        </div>
      </div>
    </div>
  )
}
