'use client'
import { useEffect, useState } from 'react'
import { adminGetStats, type AdminStats } from '@/lib/db-admin'
import type { Profile } from '@/lib/types'

const RANK_COLOR: Record<string, string> = {
  'R0': '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}

function Icon({ name }: { name: string }) {
  const a = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'users':   return <svg {...a}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    case 'network': return <svg {...a}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
    case 'pv':      return <svg {...a}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    default: return null
  }
}

function fmtSales(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtDate(iso: string) {
  return iso.slice(0, 10)
}

// Shimmer skeleton
function Shimmer({ w, h }: { w?: number | string; h?: number | string }) {
  return (
    <div style={{
      width: w ?? '100%', height: h ?? 16, borderRadius: 4,
      background: 'linear-gradient(90deg, var(--bg-inset) 25%, rgba(148,163,184,0.06) 50%, var(--bg-inset) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    adminGetStats()
      .then(setStats)
      .catch(e => setError(e?.message ?? '로딩 오류'))
      .finally(() => setLoading(false))
  }, [])

  const KPI = stats ? [
    { label: '전체 회원',     value: stats.totalMembers.toLocaleString(), sub: '등록된 노드 수', color: 'var(--accent-blue)', icon: 'users' },
    { label: '총 네트워크 PV', value: fmtSales(stats.totalSales),           sub: '전체 누적 PV',   color: '#34d399',           icon: 'pv' },
    { label: '최근 7일 가입', value: stats.recentJoined.filter(r => {
        const d = new Date(r.profile.created_at)
        return Date.now() - d.getTime() < 7 * 86400 * 1000
      }).length.toString(),
      sub: '신규 등록 레그', color: '#a78bfa', icon: 'network',
    },
    { label: '루트 노드', value: (stats.totalMembers - stats.recentJoined.length).toString(),
      sub: '스폰서 없는 계정', color: '#fbbf24', icon: 'users',
    },
  ] : []

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* Page title */}
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>
            관리자 홈
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
            전체 네트워크 현황을 모니터링합니다.
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>
            ⚠ {error}
          </div>
        )}

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Shimmer h={12} w="60%" />
                  <Shimmer h={28} w="40%" />
                  <Shimmer h={10} w="50%" />
                </div>
              ))
            : KPI.map(k => (
                <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {k.label}
                    </span>
                    <span style={{ color: k.color, opacity: 0.8 }}><Icon name={k.icon} /></span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: k.color, marginBottom: 4 }}>
                    {k.value}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>{k.sub}</div>
                </div>
              ))
          }
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Recent registrations */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                최근 레그 등록
              </span>
              <a href="/admin/requests" style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none', fontFamily: 'var(--font-main)' }}>전체 보기 →</a>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', flex: 1 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  {['노드 ID', '이름', '후원인', '등록일'].map(h => (
                    <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-main)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        {Array.from({ length: 4 }).map((__, j) => (
                          <td key={j} style={{ padding: '10px 16px' }}><Shimmer h={12} /></td>
                        ))}
                      </tr>
                    ))
                  : (stats?.recentJoined ?? []).slice(0, 5).map((row, i, arr) => (
                      <tr key={row.profile.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-blue)' }}>{row.profile.node_id}</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-primary)' }}>{row.profile.name}</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {row.sponsor?.node_id ?? '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtDate(row.profile.created_at)}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
            <div style={{ height: 12 }} />
          </div>

          {/* Recent members */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                최근 가입 회원
              </span>
              <a href="/admin/members" style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none', fontFamily: 'var(--font-main)' }}>전체 보기 →</a>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', flex: 1 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', height: 40 }}>
                  {['노드 ID', '이름', '직급', '가입일'].map(h => (
                    <th key={h} style={{ padding: '0 16px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-main)', color: 'var(--text-tertiary)', fontWeight: 600, verticalAlign: 'middle' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)', height: 44 }}>
                        {Array.from({ length: 4 }).map((__, j) => (
                          <td key={j} style={{ padding: '0 16px', verticalAlign: 'middle' }}><Shimmer h={12} /></td>
                        ))}
                      </tr>
                    ))
                  : (stats?.recentMembers ?? []).map((m, i, arr) => {
                      const rc = RANK_COLOR[m.rank] ?? '#64748b'
                      return (
                        <tr key={m.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none', height: 44 }}>
                          <td style={{ padding: '0 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-blue)', verticalAlign: 'middle' }}>{m.node_id}</td>
                          <td style={{ padding: '0 16px', fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-primary)', verticalAlign: 'middle' }}>{m.name}</td>
                          <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                              color: rc, background: rc + '18', border: `1px solid ${rc}44`,
                              padding: '2px 6px', borderRadius: 3,
                            }}>{m.rank}</span>
                          </td>
                          <td style={{ padding: '0 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', verticalAlign: 'middle' }}>{fmtDate(m.created_at)}</td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
