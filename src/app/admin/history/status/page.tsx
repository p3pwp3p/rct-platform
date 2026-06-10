'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type StatusHistoryRow = {
  id: string
  profile_id: string
  old_status: string
  new_status: string
  reason: string | null
  changed_at: string
  profile_name: string
  profile_node_id: string
}

const STATUS_LABEL: Record<string, string> = {
  active:    '정상',
  suspended: '정지',
  expelled:  '제명',
}
const STATUS_COLOR: Record<string, string> = {
  active:    '#34d399',
  suspended: '#fbbf24',
  expelled:  '#f87171',
}

function Shimmer() {
  return <div style={{ height: 14, width: '70%', borderRadius: 4, background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.06) 50%,var(--bg-inset) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}/>
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? '#64748b'
  return (
    <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: c, background: c + '18', border: `1px solid ${c}44`, padding: '2px 8px', borderRadius: 4 }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function StatusHistoryPage() {
  const [rows,    setRows]    = useState<StatusHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState<string>('all')

  useEffect(() => {
    async function load() {
      try {
        const { data, error: e } = await supabase
          .from('status_history')
          .select('id, profile_id, old_status, new_status, reason, changed_at')
          .order('changed_at', { ascending: false })
        if (e) throw e

        const profileIds = [...new Set((data ?? []).map((r: any) => r.profile_id))]
        const { data: profiles } = profileIds.length
          ? await supabase.from('profiles').select('id, name, node_id').in('id', profileIds)
          : { data: [] }
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

        setRows((data ?? []).map((r: any) => {
          const p = profileMap.get(r.profile_id) as any
          return {
            id:              r.id,
            profile_id:      r.profile_id,
            old_status:      r.old_status,
            new_status:      r.new_status,
            reason:          r.reason,
            changed_at:      r.changed_at,
            profile_name:    p?.name    ?? '알 수 없음',
            profile_node_id: p?.node_id ?? '',
          }
        }))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : (e as any)?.message ?? JSON.stringify(e) ?? '오류')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = rows.filter(r => {
    const matchSearch = !search || r.profile_name.includes(search) || r.profile_node_id.includes(search)
    const matchFilter = filter === 'all' || r.new_status === filter
    return matchSearch && matchFilter
  })

  const counts = {
    suspended: rows.filter(r => r.new_status === 'suspended').length,
    expelled:  rows.filter(r => r.new_status === 'expelled').length,
    active:    rows.filter(r => r.new_status === 'active').length,
  }

  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>상태 변경 히스토리</h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
              {loading ? '로딩 중...' : `전체 ${rows.length}건`}
            </p>
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 노드ID 검색"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)', padding: '8px 14px 8px 32px', borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-main)', outline: 'none', width: 200 }}/>
          </div>
        </div>

        {/* 필터 + 요약 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { key: 'all',       label: '전체',    cnt: rows.length },
            { key: 'suspended', label: '정지',    cnt: counts.suspended },
            { key: 'expelled',  label: '제명',    cnt: counts.expelled },
            { key: 'active',    label: '복구',    cnt: counts.active },
          ].map(({ key, label, cnt }) => {
            const active = filter === key
            const c = key === 'all' ? 'var(--accent-blue)' : STATUS_COLOR[key] ?? 'var(--text-secondary)'
            return (
              <button key={key} onClick={() => setFilter(key)}
                style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${active ? c : 'var(--border-secondary)'}`, background: active ? (c + '18') : 'transparent', color: active ? c : 'var(--text-tertiary)', fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                {label}
                {!loading && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{cnt}</span>}
              </button>
            )
          })}
        </div>

        {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>⚠ {error}</div>}

        {/* 테이블 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'rgba(10,12,16,0.3)' }}>
                {['변경 일시','회원 / 노드 ID','이전 상태','','새 상태','사유'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-main)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      {Array.from({ length: 6 }).map((__, j) => <td key={j} style={{ padding: '12px 16px' }}><Shimmer/></td>)}
                    </tr>
                  ))
                : filtered.length === 0
                  ? (
                    <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                      {rows.length === 0 ? '상태 변경 이력이 없습니다' : '검색 결과 없음'}
                    </td></tr>
                  )
                  : filtered.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {r.changed_at.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{r.profile_name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-blue)' }}>{r.profile_node_id}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}><StatusBadge status={r.old_status}/></td>
                      <td style={{ padding: '12px 4px', color: 'var(--text-tertiary)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </td>
                      <td style={{ padding: '12px 16px' }}><StatusBadge status={r.new_status}/></td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 280 }}>
                        {r.reason
                          ? <span title={r.reason} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</span>
                          : <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        }
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
