'use client'
import { useEffect, useState } from 'react'
import { useProfile } from '@/lib/contexts/ProfileContext'
import { supabase } from '@/lib/supabase'

interface PayoutRow {
  id: string
  bonus_type: 'referral' | 'rank' | 'sponsor'
  amount: number
  rate: number
  generation: number
  created_at: string
  profit_reports: { date_from: string; date_to: string; status: string } | null
}

const BONUS_LABEL: Record<string, string> = { referral: '추천수당', rank: '직급수당', sponsor: '후원수당' }
const BONUS_COLOR: Record<string, string> = { referral: '#a78bfa', rank: '#60a5fa', sponsor: '#fbbf24' }
const STATUS_LABEL: Record<string, string> = { pending: '검토중', confirmed: '확인됨', paid: '지급완료', failed: '전송실패' }
const STATUS_COLOR: Record<string, string> = { pending: '#fbbf24', confirmed: '#60a5fa', paid: '#34d399', failed: '#f87171' }

function fmt(n: number) { return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function Skeleton({ w = '60%', h = 14 }: { w?: string; h?: number }) {
  return <div style={{ width: w, height: h, borderRadius: 4, background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.07) 50%,var(--bg-inset) 75%)', backgroundSize: '200% 100%', animation: 'sk 1.4s infinite' }}/>
}

export default function ReceiptsPage() {
  const { activeProfile, loading: profileLoading } = useProfile()
  const profileId = activeProfile?.id ?? ''

  const [rows, setRows]       = useState<PayoutRow[]>([])
  const [totals, setTotals]   = useState({ referral: 0, rank: 0, sponsor: 0, total: 0 })
  const [rowCount, setRowCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'referral' | 'rank' | 'sponsor'>('all')

  useEffect(() => {
    if (profileLoading) return
    if (!profileId) { setLoading(false); return }
    setLoading(true)
    supabase.auth.getSession()
      .then(({ data: { session } }) =>
        fetch(`/api/my-payouts?profileId=${profileId}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } }))
      .then(r => r.json())
      .then(d => {
        setRows(d.rows ?? [])
        setTotals(d.totals ?? { referral: 0, rank: 0, sponsor: 0, total: 0 })
        setRowCount(d.rowCount ?? (d.rows?.length ?? 0))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [profileId, profileLoading])

  const totalReferral = totals.referral, totalRank = totals.rank, totalSponsor = totals.sponsor
  const totalAll = totals.total
  const filtered = filter === 'all' ? rows : rows.filter(r => r.bonus_type === filter)

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

          {/* KPI 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {[
              { label: '총 수령액', value: totalAll,      color: '#34d399' },
              { label: '추천수당', value: totalReferral, color: '#a78bfa' },
              { label: '직급수당', value: totalRank,     color: '#60a5fa' },
              { label: '후원수당', value: totalSponsor,  color: '#fbbf24' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>{k.label}</div>
                {loading
                  ? <Skeleton w="80%" h={22} />
                  : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: k.color }}>${fmt(k.value)}</div>}
              </div>
            ))}
          </div>

          {/* 상세 내역 */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                수당 수령 내역 {!loading && `(${filter === 'all' ? rowCount : filtered.length}건)`}
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
                <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(10,12,16,0.3)' }}>
                      {['기간', '수당 종류', '세대/압축', '비율', '보고서 상태', '수령액'].map((h, i) => (
                        <th key={h} style={{ padding: '9px 16px', textAlign: i >= 4 ? (i === 5 ? 'right' : 'center') : 'left', fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => {
                      const c = BONUS_COLOR[row.bonus_type]
                      const period = row.profit_reports ? `${row.profit_reports.date_from} ~ ${row.profit_reports.date_to}` : row.created_at.slice(0, 10)
                      const st = row.profit_reports?.status
                      const sc = st ? STATUS_COLOR[st] : 'var(--text-tertiary)'
                      return (
                        <tr key={row.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-primary)' }}>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{period}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, color: c, background: c + '18', border: `1px solid ${c}44`, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>{BONUS_LABEL[row.bonus_type]}</span>
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{row.generation > 0 ? `${row.generation}대` : '—'}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fbbf24' }}>{(row.rate * 100).toFixed(1)}%</td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            {st ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: sc, background: sc + '18', border: `1px solid ${sc}44`, padding: '1px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>{STATUS_LABEL[st]}</span> : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>${fmt(row.amount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
