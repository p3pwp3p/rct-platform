'use client'
import { useEffect, useState } from 'react'
import { useProfile } from '@/lib/contexts/ProfileContext'
import { supabase } from '@/lib/supabase'

interface BreakdownRow {
  bonus_type: 'referral' | 'rank' | 'sponsor'
  generation: number
  rate: number
  count: number
  amount: number
}

const BONUS_LABEL: Record<string, string> = { referral: '추천수당', rank: '직급수당', sponsor: '후원수당' }
const BONUS_COLOR: Record<string, string> = { referral: '#a78bfa', rank: '#60a5fa', sponsor: '#fbbf24' }

function fmt(n: number) { return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function Skeleton({ w = '60%', h = 14 }: { w?: string; h?: number }) {
  return <div style={{ width: w, height: h, borderRadius: 4, background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.07) 50%,var(--bg-inset) 75%)', backgroundSize: '200% 100%', animation: 'sk 1.4s infinite' }}/>
}

// 구분 라벨: 추천=세대, 직급=직급 tier, 후원=바이너리
function divisionLabel(r: BreakdownRow): string {
  if (r.bonus_type === 'referral') return `${r.generation}대`
  if (r.bonus_type === 'rank')     return `R${r.generation} 직급`
  return '바이너리 소실적'
}

export default function ReceiptsPage() {
  const { activeProfile, loading: profileLoading } = useProfile()
  const profileId = activeProfile?.id ?? ''

  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([])
  const [totals, setTotals]       = useState({ referral: 0, rank: 0, sponsor: 0, total: 0 })
  const [rowCount, setRowCount]   = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [filter, setFilter]       = useState<'all' | 'referral' | 'rank' | 'sponsor'>('all')

  useEffect(() => {
    if (profileLoading) return
    if (!profileId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    supabase.auth.getSession()
      .then(({ data: { session } }) =>
        fetch(`/api/my-payouts?profileId=${profileId}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } }))
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d?.error ?? `요청 실패 (${r.status})`)
        return d
      })
      .then(d => {
        setBreakdown(d.breakdown ?? [])
        setTotals(d.totals ?? { referral: 0, rank: 0, sponsor: 0, total: 0 })
        setRowCount(d.rowCount ?? 0)
      })
      .catch(e => { console.error('[receipts]', e); setError('수령 내역을 불러오지 못했습니다.') })
      .finally(() => setLoading(false))
  }, [profileId, profileLoading])

  const filtered = filter === 'all' ? breakdown : breakdown.filter(b => b.bonus_type === filter)

  return (
    <>
      <style>{`@keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 900, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

          {/* 헤더 */}
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>수령 현황</h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
              내가 추천·직급·후원 수당으로 받은 금액
            </p>
          </div>

          {error && (
            <div style={{
              padding: '12px 16px', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
              fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171',
            }}>⚠ {error}</div>
          )}

          {/* KPI 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {[
              { label: '총 수령액', value: totals.total,    color: '#34d399' },
              { label: '추천수당', value: totals.referral, color: '#a78bfa' },
              { label: '직급수당', value: totals.rank,     color: '#60a5fa' },
              { label: '후원수당', value: totals.sponsor,  color: '#fbbf24' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>{k.label}</div>
                {loading
                  ? <Skeleton w="80%" h={22} />
                  : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: k.color }}>{fmt(k.value)}</div>}
              </div>
            ))}
          </div>

          {/* 통합 내역 (타입·세대별 합산) */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                수당 항목별 합산 {!loading && `· 총 ${rowCount.toLocaleString('ko-KR')}건`}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['all', 'referral', 'rank', 'sponsor'] as const).map(t => (
                  <button key={t} onClick={() => setFilter(t)}
                    style={{
                      padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: filter === t ? 700 : 400,
                      background: filter === t ? (t === 'all' ? 'rgba(148,163,184,0.15)' : BONUS_COLOR[t] + '20') : 'transparent',
                      color: filter === t ? (t === 'all' ? 'var(--text-primary)' : BONUS_COLOR[t]) : 'var(--text-tertiary)',
                      transition: 'all 0.15s',
                    }}>
                    {t === 'all' ? '전체' : BONUS_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} w="100%" h={14} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                수령 내역이 없습니다
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(10,12,16,0.3)' }}>
                      {[
                        { h: '수당 종류', a: 'left'   },
                        { h: '구분',      a: 'left'   },
                        { h: '지급률',    a: 'center' },
                        { h: '건수',      a: 'center' },
                        { h: '합계',      a: 'right'  },
                      ].map(c => (
                        <th key={c.h} style={{ padding: '10px 18px', textAlign: c.a as 'left'|'center'|'right', fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{c.h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const c = BONUS_COLOR[r.bonus_type]
                      return (
                        <tr key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-primary)' }}>
                          <td style={{ padding: '12px 18px' }}>
                            <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, color: c, background: c + '18', border: `1px solid ${c}44`, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>{BONUS_LABEL[r.bonus_type]}</span>
                          </td>
                          <td style={{ padding: '12px 18px', fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{divisionLabel(r)}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fbbf24' }}>{(r.rate * 100).toFixed(1)}%</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{r.count.toLocaleString('ko-KR')}건</td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>{fmt(r.amount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 비율 설명 */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-primary)', background: 'rgba(10,12,16,0.2)', fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>지급률</strong>은 수익(분윤) 금액에서 해당 수당으로 지급되는 비율입니다.
              예: 직급수당 R3는 분윤의 2% — 하위 노드 수익 150마다 3이 지급됩니다.
              <br/>
              <strong style={{ color: 'var(--text-secondary)' }}>구분</strong> — 추천수당은 추천 세대(1~4대), 직급수당은 직급 단계(R1·R2·R3…), 후원수당은 바이너리 약한 레그 기준입니다.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
