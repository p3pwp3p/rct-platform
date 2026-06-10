'use client'
import { useEffect, useState } from 'react'
import { adminGetLegs, type AdminLeg } from '@/lib/db-admin'

const RANK_COLOR: Record<string, string> = {
  'R0': '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}

function fmtSales(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n > 0 ? String(n) : '—'
}

function Shimmer() {
  return (
    <div style={{
      height: 13, borderRadius: 4, width: '70%',
      background: 'linear-gradient(90deg, var(--bg-inset) 25%, rgba(148,163,184,0.06) 50%, var(--bg-inset) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

type SortKey = 'node_id' | 'name' | 'sponsor' | 'referrer' | 'sales' | 'rank' | 'leg' | 'depth' | 'created_at'
type SortDir = 'asc' | 'desc'

const RANK_ORDER_MAP: Record<string, number> = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4, R5: 5 }

export default function LegsPage() {
  const [legs, setLegs]       = useState<AdminLeg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState<'all' | 'left' | 'right'>('all')
  const [sort, setSort]       = useState<SortKey>('created_at')
  const [dir, setDir]         = useState<SortDir>('desc')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    adminGetLegs()
      .then(setLegs)
      .catch(e => setError(e?.message ?? '로딩 오류'))
      .finally(() => setLoading(false))
  }, [])

  const totalSales = legs.reduce((s, l) => s + l.profile.sales, 0)
  const leftCount  = legs.filter(l => l.profile.leg_position === 'LEFT').length
  const rightCount = legs.filter(l => l.profile.leg_position === 'RIGHT').length
  const maxSales   = totalSales > 0 ? totalSales : 1

  const handleSort = (key: SortKey) => {
    if (sort === key) setDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSort(key); setDir(key === 'created_at' ? 'desc' : 'asc') }
  }

  const list = legs
    .filter(l => filter === 'all' || l.profile.leg_position === filter.toUpperCase())
    .filter(l => !search ||
      l.profile.name.includes(search) ||
      l.profile.node_id.includes(search) ||
      l.profile.ct_id.includes(search) ||
      (l.sponsor?.node_id ?? '').includes(search)
    )
    .sort((a, b) => {
      let v = 0
      if (sort === 'node_id')   v = a.profile.node_id.localeCompare(b.profile.node_id)
      else if (sort === 'name') v = a.profile.name.localeCompare(b.profile.name)
      else if (sort === 'sponsor') v = (a.sponsor?.node_id ?? '').localeCompare(b.sponsor?.node_id ?? '')
      else if (sort === 'referrer') v = (a.referrer?.node_id ?? '').localeCompare(b.referrer?.node_id ?? '')
      else if (sort === 'sales') v = a.profile.sales - b.profile.sales
      else if (sort === 'rank')  v = RANK_ORDER_MAP[a.profile.rank] - RANK_ORDER_MAP[b.profile.rank]
      else if (sort === 'leg')   v = (a.profile.leg_position ?? '').localeCompare(b.profile.leg_position ?? '')
      else if (sort === 'depth') v = a.depth - b.depth
      else v = new Date(a.profile.created_at).getTime() - new Date(b.profile.created_at).getTime()
      return dir === 'asc' ? v : -v
    })

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>
            전체 레그 현황
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
            {loading
              ? '로딩 중...'
              : `총 ${legs.length}개 레그 · LEFT ${leftCount} · RIGHT ${rightCount} · 총 매출 ${fmtSales(totalSales)}`
            }
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 노드ID, CT, 후원인 검색"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)', padding: '8px 14px 8px 32px', borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-main)', outline: 'none', width: 230 }}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>
          ⚠ {error}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'left', 'right'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px', borderRadius: 4, fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', border: '1px solid',
              borderColor: filter === f ? 'var(--accent-blue)' : 'var(--border-secondary)',
              background: filter === f ? 'var(--accent-blue-dim)' : 'transparent',
              color: filter === f ? 'var(--accent-blue)' : 'var(--text-tertiary)', transition: 'all 0.15s',
            }}>
              {f === 'all' ? '전체' : f === 'left' ? 'LEFT 레그' : 'RIGHT 레그'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
          컬럼 헤더를 클릭해 정렬
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'rgba(10,12,16,0.3)' }}>
              {([
                { label: '노드 / CT', key: 'node_id'   as SortKey, align: 'left',   width: 120 },
                { label: '이름',      key: 'name'       as SortKey, align: 'left',   width: 100 },
                { label: '후원인',    key: 'sponsor'    as SortKey, align: 'left',   width: 110 },
                { label: '추천인',    key: 'referrer'   as SortKey, align: 'left',   width: 110 },
                { label: '매출',      key: 'sales'      as SortKey, align: 'left',   width: 160 },
                { label: '직급',      key: 'rank'       as SortKey, align: 'left',   width: 70  },
                { label: '레그',      key: 'leg'        as SortKey, align: 'center', width: 90  },
                { label: '깊이',      key: 'depth'      as SortKey, align: 'center', width: 60  },
                { label: '가입일',    key: 'created_at' as SortKey, align: 'left',   width: 100 },
              ]).map(({ label, key, align, width }) => {
                const active = sort === key
                const arrow = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
                return (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{
                      padding: '10px 16px', textAlign: align as 'left' | 'center',
                      fontSize: 11, fontFamily: 'var(--font-main)', fontWeight: 600,
                      whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
                      color: active ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                      transition: 'color 0.15s',
                      width,
                    }}
                  >{label}{arrow}</th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} style={{ padding: '13px 16px' }}><Shimmer /></td>
                    ))}
                  </tr>
                ))
              : list.map((leg, i) => {
                  const { profile, sponsor, referrer, depth } = leg
                  const rc  = RANK_COLOR[profile.rank] ?? '#64748b'
                  const bar = profile.sales > 0 ? Math.round((profile.sales / maxSales) * 100) : 0
                  const legColor = profile.leg_position === 'LEFT' ? '#60a5fa' : '#a78bfa'

                  return (
                    <tr key={profile.id} style={{ borderBottom: i < list.length - 1 ? '1px solid var(--border-primary)' : 'none', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(148,163,184,0.03)'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>{profile.node_id}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{profile.ct_id}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)' }}>{profile.name}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                        {sponsor ? sponsor.node_id : '—'}
                        {sponsor && <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{sponsor.name}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {referrer ? referrer.node_id : '—'}
                        {referrer && <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{referrer.name}</div>}
                      </td>
                      <td style={{ padding: '12px 48px 12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ height: 7, background: 'var(--border-primary)', borderRadius: 4 }}>
                            <div style={{ width: `${bar}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: 4, transition: 'width 0.4s' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
                              {bar > 0 ? `${bar.toFixed(1)}%` : '—'}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: profile.sales > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                              {fmtSales(profile.sales)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: rc, background: rc + '18', border: `1px solid ${rc}44`, padding: '2px 7px', borderRadius: 4 }}>
                          {profile.rank}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: legColor, background: legColor + '18', border: `1px solid ${legColor}44`, padding: '2px 8px', borderRadius: 4 }}>
                          {profile.leg_position}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 4, background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {depth}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {profile.created_at.slice(0, 10)}
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
