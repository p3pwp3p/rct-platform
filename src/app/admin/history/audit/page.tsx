'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'

type AuditRow = {
  id: string
  actor_email: string | null
  action: string
  target_type: string | null
  target_id: string | null
  detail: Record<string, unknown> | null
  created_at: string
}

const ACTION: Record<string, { label: string; color: string }> = {
  delete_node:   { label: '노드 삭제', color: '#f87171' },
  payout_calc:   { label: '수당 계산', color: '#34d399' },
  member_update: { label: '회원 수정', color: '#60a5fa' },
}
const meta = (a: string) => ACTION[a] ?? { label: a, color: '#94a3b8' }

function Shimmer() {
  return <div style={{ height: 14, width: '70%', borderRadius: 4, background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.06) 50%,var(--bg-inset) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}/>
}
function detailText(d: Record<string, unknown> | null): string {
  if (!d) return '—'
  return Object.entries(d).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')
}

export default function AuditLogPage() {
  const [rows, setRows]     = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [filter, setFilter] = useState<string>('all')
  const isMobile = useIsMobile()

  useEffect(() => {
    supabase.from('admin_audit_log')
      .select('id, actor_email, action, target_type, target_id, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error: e }) => {
        if (e) setError(e.message)
        else setRows(data ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = filter === 'all' ? rows : rows.filter(r => r.action === filter)

  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ padding: isMobile ? 16 : 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>감사 로그</h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
            {loading ? '로딩 중...' : `노드 삭제·수당 계산·회원 수정 이력 (최근 ${rows.length}건)`}
          </p>
        </div>

        {/* 필터 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ k: 'all', label: '전체' }, ...Object.entries(ACTION).map(([k, v]) => ({ k, label: v.label }))].map(({ k, label }) => {
            const active = filter === k
            const c = k === 'all' ? 'var(--accent-blue)' : meta(k).color
            return (
              <button key={k} onClick={() => setFilter(k)}
                style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${active ? c : 'var(--border-secondary)'}`, background: active ? c + '18' : 'transparent', color: active ? c : 'var(--text-tertiary)', fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer' }}>
                {label}
              </button>
            )
          })}
        </div>

        {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>⚠ {error}</div>}

        {/* 모바일 카드 */}
        {isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading
              ? [1,2,3,4].map(i => <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: 14 }}><Shimmer/></div>)
              : filtered.length === 0
                ? <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>기록이 없습니다</div>
                : filtered.map(r => {
                    const m = meta(r.action)
                    return (
                      <div key={r.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 700, color: m.color, background: m.color + '18', border: `1px solid ${m.color}44`, padding: '2px 8px', borderRadius: 4 }}>{m.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-blue)' }}>{r.target_id ?? '—'}</span>
                          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{r.created_at.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{r.actor_email ?? '—'}</div>
                        <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-primary)', paddingTop: 7, lineHeight: 1.5, wordBreak: 'break-all' }}>{detailText(r.detail)}</div>
                      </div>
                    )
                  })
            }
          </div>
        )}

        {/* 데스크톱 테이블 */}
        {!isMobile && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-header)' }}>
                {['일시', '행위자', '작업', '대상', '상세'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-main)', color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [1,2,3,4,5].map(i => <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>{[1,2,3,4,5].map(j => <td key={j} style={{ padding: '12px 16px' }}><Shimmer/></td>)}</tr>)
                : filtered.length === 0
                  ? <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>기록이 없습니다</td></tr>
                  : filtered.map((r, i) => {
                      const m = meta(r.action)
                      return (
                        <tr key={r.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                          <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{r.created_at.slice(0, 16).replace('T', ' ')}</td>
                          <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{r.actor_email ?? '—'}</td>
                          <td style={{ padding: '11px 16px' }}><span style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 700, color: m.color, background: m.color + '18', border: `1px solid ${m.color}44`, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>{m.label}</span></td>
                          <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)', whiteSpace: 'nowrap' }}>{r.target_id ?? '—'}</td>
                          <td style={{ padding: '11px 16px', fontFamily: 'var(--font-main)', fontSize: 11.5, color: 'var(--text-tertiary)', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={detailText(r.detail)}>{detailText(r.detail)}</td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>
        )}
      </div>
    </>
  )
}
