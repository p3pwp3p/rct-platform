'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

type LedgerRow = {
  profile_id: string
  node_id: string
  name: string
  rank: string
  status: string
  trc20_address: string | null
  referral: number
  rank_bonus: number
  sponsor: number
  total: number
  count: number
}

const RANK_COLOR: Record<string, string> = {
  R0: '#64748b', R1: '#34d399', R2: '#60a5fa', R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function Shimmer({ w = '70%', h = 14 }: { w?: string; h?: number }) {
  return <div style={{ height: h, width: w, borderRadius: 4, background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.06) 50%,var(--bg-inset) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}/>
}

export default function PayoutLedgerPage() {
  const [rows, setRows]       = useState<LedgerRow[]>([])
  const [totals, setTotals]   = useState({ referral: 0, rank: 0, sponsor: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [query, setQuery]     = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인이 필요합니다.')
      const res  = await fetch('/api/admin/payout-ledger', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '조회 실패')
      setRows(json.rows ?? [])
      setTotals(json.totals ?? { referral: 0, rank: 0, sponsor: 0, total: 0 })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (e as any)?.message ?? '오류')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.node_id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    )
  }, [rows, query])

  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>노드별 수령 현황</h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
              각 노드가 추천·직급·후원 수당으로 받은 누적 금액
            </p>
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="노드 ID / 이름 검색"
              style={{ width: 240, padding: '8px 12px 8px 30px', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-main)', fontSize: 12, outline: 'none' }}/>
          </div>
        </div>

        {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>⚠ {error}</div>}

        {/* KPI 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {[
            { label: '총 지급액',   value: totals.total,    color: '#34d399' },
            { label: '추천수당 합', value: totals.referral, color: '#a78bfa' },
            { label: '직급수당 합', value: totals.rank,     color: '#60a5fa' },
            { label: '후원수당 합', value: totals.sponsor,  color: '#fbbf24' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>{k.label}</div>
              {loading ? <Shimmer h={22}/> : (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: k.color }}>
                  {fmt(k.value)} <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>USDT</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 테이블 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflowX: 'auto', overflowY: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-primary)', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            수령 노드 {!loading && `(${filtered.length}명)`}
          </div>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'rgba(10,12,16,0.3)' }}>
                {[
                  { label: '회원 / 노드 ID', align: 'left'  },
                  { label: '직급',          align: 'center' },
                  { label: '추천수당',       align: 'right' },
                  { label: '직급수당',       align: 'right' },
                  { label: '후원수당',       align: 'right' },
                  { label: '합계',          align: 'right' },
                  { label: '건수',          align: 'center' },
                ].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: h.align as 'left'|'center'|'right', fontSize: 11, fontFamily: 'var(--font-main)', color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      {Array.from({ length: 7 }).map((__, j) => <td key={j} style={{ padding: '12px 16px' }}><Shimmer/></td>)}
                    </tr>
                  ))
                : filtered.length === 0
                  ? <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>수령 내역이 없습니다. 먼저 수당을 계산해주세요.</td></tr>
                  : filtered.map((r, i) => {
                      const rc = RANK_COLOR[r.rank] ?? '#64748b'
                      return (
                        <tr key={r.profile_id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-blue)' }}>{r.node_id}</div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: rc, background: rc + '18', border: `1px solid ${rc}44`, padding: '1px 7px', borderRadius: 4 }}>{r.rank}</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: r.referral > 0 ? '#c4b5fd' : 'var(--text-tertiary)' }}>{r.referral > 0 ? fmt(r.referral) : '—'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: r.rank_bonus > 0 ? '#93c5fd' : 'var(--text-tertiary)' }}>{r.rank_bonus > 0 ? fmt(r.rank_bonus) : '—'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: r.sponsor > 0 ? '#fcd34d' : 'var(--text-tertiary)' }}>{r.sponsor > 0 ? fmt(r.sponsor) : '—'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#34d399' }}>{fmt(r.total)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{r.count}</td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
