'use client'
import { useEffect, useRef, useState } from 'react'
import { useProfile } from '@/lib/contexts/ProfileContext'
import { supabase } from '@/lib/supabase'

interface BreakdownRow {
  bonus_type: 'referral' | 'rank' | 'sponsor'
  generation: number
  rate: number
  count: number
  amount: number
}
interface MonthRow {
  month: string   // 'YYYY-MM'
  referral: number
  rank: number
  sponsor: number
  total: number
  count: number
}

const BONUS_LABEL: Record<string, string> = { referral: '추천수당', rank: '직급수당', sponsor: '후원수당' }
const BONUS_COLOR: Record<string, string> = { referral: '#a78bfa', rank: '#60a5fa', sponsor: '#fbbf24' }
const TYPES = ['referral', 'rank', 'sponsor'] as const

function fmt(n: number)    { return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtInt(n: number) { return Math.round(n).toLocaleString('ko-KR') }
function monthShort(m: string) { const [, mm] = m.split('-'); return mm ? `${parseInt(mm, 10)}월` : m }
function monthLong(m: string)  { const [y, mm] = m.split('-'); return mm ? `${y}년 ${parseInt(mm, 10)}월` : m }

function Skeleton({ w = '60%', h = 14 }: { w?: string | number; h?: number }) {
  return <div style={{ width: w, height: h, borderRadius: 4, background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.07) 50%,var(--bg-inset) 75%)', backgroundSize: '200% 100%', animation: 'sk 1.4s infinite' }}/>
}

function divisionLabel(r: BreakdownRow): string {
  if (r.bonus_type === 'referral') return `${r.generation}대`
  if (r.bonus_type === 'rank')     return `R${r.generation} 직급`
  return '바이너리 소실적'
}

// ─── 기간 선택 드롭다운 ────────────────────────────────────────────────────────
function MonthDropdown({ months, value, onChange }: {
  months: string[]; value: string | null; onChange: (m: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // 최신 월이 위로 오도록 내림차순
  const opts: (string | null)[] = [null, ...[...months].sort((a, b) => b.localeCompare(a))]
  const label = value ? monthLong(value) : '전체 기간'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer',
          background: 'var(--bg-inset)', border: `1px solid ${open ? '#34d399' : 'var(--border-secondary)'}`,
          borderRadius: 7, fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-primary)', transition: 'border-color 0.15s',
        }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ minWidth: 70, textAlign: 'left' }}>{label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="md-menu" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30,
          minWidth: 150, maxHeight: 260, overflowY: 'auto',
          background: 'var(--bg-surface)', border: '1px solid var(--border-secondary)',
          borderRadius: 8, padding: 4, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }}>
          {opts.map(o => {
            const sel = o === value
            return (
              <button key={o ?? 'all'} onClick={() => { onChange(o); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
                  padding: '8px 10px', cursor: 'pointer', border: 'none', borderRadius: 5, textAlign: 'left',
                  background: sel ? 'rgba(52,211,153,0.12)' : 'transparent',
                  fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: sel ? 700 : 400,
                  color: sel ? '#34d399' : 'var(--text-secondary)', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(148,163,184,0.06)' }}
                onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                {o ? monthLong(o) : '전체 기간'}
                {sel && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 월별 수령 추이 (stacked bar) ──────────────────────────────────────────────
function MonthlyChart({ monthly, selected, onSelect }: {
  monthly: MonthRow[]; selected: string | null; onSelect: (m: string | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const measure = () => setW(Math.max(320, el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const H = 220, PAD_L = 52, PAD_R = 16, PAD_T = 16, PAD_B = 34
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const maxVal = Math.max(...monthly.map(m => m.total), 1) * 1.15
  const baseY = PAD_T + plotH

  const n = monthly.length
  const slotW = n > 0 ? plotW / n : plotW
  const barW = Math.min(56, slotW * 0.5)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: baseY - f * plotH, label: fmtInt(maxVal * f) }))

  const barX = (i: number) => PAD_L + slotW * i + slotW / 2 - barW / 2

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>월별 수령 추이</span>
          <MonthDropdown months={monthly.map(m => m.month)} value={selected} onChange={onSelect} />
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {TYPES.map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-secondary)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: BONUS_COLOR[t] }} />
              {BONUS_LABEL[t]}
            </div>
          ))}
        </div>
      </div>

      <div ref={wrapRef} style={{ position: 'relative', padding: '8px 0 0' }}>
        {n === 0 ? (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>
            아직 월별 수령 내역이 없습니다
          </div>
        ) : (
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}
            onMouseLeave={() => setHover(null)}>
            {/* y 그리드 + 라벨 */}
            {yTicks.map((t, i) => (
              <g key={i}>
                <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray={i === 0 ? undefined : '3 3'} opacity={0.6}/>
                <text x={PAD_L - 8} y={t.y + 3.5} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-tertiary)">{t.label}</text>
              </g>
            ))}

            {monthly.map((m, i) => {
              const x = barX(i)
              const isSel = selected === m.month
              const isHov = hover === i
              const dim = (selected && !isSel) ? 0.35 : 1
              let yCursor = baseY
              const segs = TYPES.map(t => {
                const h = (m[t] / maxVal) * plotH
                const y = yCursor - h
                yCursor = y
                return { t, y, h }
              })
              return (
                <g key={m.month} style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => onSelect(isSel ? null : m.month)}>
                  {/* hover/선택 배경 */}
                  <rect x={PAD_L + slotW * i + 2} y={PAD_T} width={slotW - 4} height={plotH} rx={6}
                    fill={isHov || isSel ? 'rgba(148,163,184,0.06)' : 'transparent'} />
                  {segs.map((s, si) => s.h <= 0 ? null : (
                    <rect key={si} x={x} y={s.y + (si < segs.length - 1 ? 1 : 0)} width={barW} height={Math.max(0, s.h - 1)}
                      rx={2} fill={BONUS_COLOR[s.t]} opacity={dim}
                      style={{ transition: 'opacity 0.2s' }}/>
                  ))}
                  {/* 총액 라벨 */}
                  <text x={x + barW / 2} y={segs[segs.length - 1].y - 6} textAnchor="middle"
                    fontFamily="var(--font-mono)" fontSize="10" fontWeight="700"
                    fill={isSel ? 'var(--text-primary)' : 'var(--text-secondary)'} opacity={dim}>
                    {fmtInt(m.total)}
                  </text>
                  {/* x 라벨 */}
                  <text x={x + barW / 2} y={baseY + 20} textAnchor="middle"
                    fontFamily="var(--font-main)" fontSize="12" fontWeight={isSel ? 700 : 400}
                    fill={isSel ? '#34d399' : 'var(--text-tertiary)'}>
                    {monthShort(m.month)}
                  </text>
                </g>
              )
            })}
          </svg>
        )}

        {/* hover 툴팁 */}
        {hover != null && monthly[hover] && (
          <div style={{
            position: 'absolute', left: `${(barX(hover) + barW / 2) / W * 100}%`, top: 12,
            transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 5,
            background: 'var(--bg-surface)', border: '1px solid var(--border-secondary)',
            borderRadius: 8, padding: '8px 12px', whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 5 }}>{monthLong(monthly[hover].month)}</div>
            {TYPES.map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 2 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: BONUS_COLOR[t] }} />
                <span style={{ color: 'var(--text-tertiary)', minWidth: 52 }}>{BONUS_LABEL[t]}</span>
                <span style={{ color: BONUS_COLOR[t], fontWeight: 700, marginLeft: 'auto' }}>{fmt(monthly[hover][t])}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--border-primary)', marginTop: 4, paddingTop: 4, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>합계</span>
              <span style={{ color: '#34d399', fontWeight: 700, marginLeft: 'auto' }}>{fmt(monthly[hover].total)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReceiptsPage() {
  const { activeProfile, loading: profileLoading } = useProfile()
  const profileId = activeProfile?.id ?? ''

  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([])
  const [totals, setTotals]       = useState({ referral: 0, rank: 0, sponsor: 0, total: 0 })
  const [monthly, setMonthly]     = useState<MonthRow[]>([])
  const [byMonth, setByMonth]     = useState<Record<string, BreakdownRow[]>>({})
  const [rowCount, setRowCount]   = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [filter, setFilter]       = useState<'all' | 'referral' | 'rank' | 'sponsor'>('all')
  const [month, setMonth]         = useState<string | null>(null)  // null = 전체

  useEffect(() => {
    if (profileLoading) return
    if (!profileId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    setMonth(null)
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
        setMonthly(d.monthly ?? [])
        setByMonth(d.breakdownByMonth ?? {})
        setRowCount(d.rowCount ?? 0)
      })
      .catch(e => { console.error('[receipts]', e); setError('수령 내역을 불러오지 못했습니다.') })
      .finally(() => setLoading(false))
  }, [profileId, profileLoading])

  // 선택 월에 따른 scope
  const monthData = month ? monthly.find(m => m.month === month) : null
  const scopeTotals = monthData
    ? { referral: monthData.referral, rank: monthData.rank, sponsor: monthData.sponsor, total: monthData.total }
    : totals
  const scopeBreakdown = month ? (byMonth[month] ?? []) : breakdown
  const scopeCount = month ? (monthData?.count ?? 0) : rowCount
  const filtered = filter === 'all' ? scopeBreakdown : scopeBreakdown.filter(b => b.bonus_type === filter)

  return (
    <>
      <style>{`
        @keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .md-menu { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.2) transparent; }
        .md-menu::-webkit-scrollbar { width: 6px; }
        .md-menu::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.2); border-radius: 3px; }
      `}</style>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

          {/* 헤더 */}
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>수령 현황</h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
              내가 추천·직급·후원 수당으로 받은 금액
            </p>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>⚠ {error}</div>
          )}

          {/* KPI 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {[
              { label: month ? `${monthShort(month)} 수령액` : '총 수령액', value: scopeTotals.total, color: '#34d399' },
              { label: '추천수당', value: scopeTotals.referral, color: '#a78bfa' },
              { label: '직급수당', value: scopeTotals.rank,     color: '#60a5fa' },
              { label: '후원수당', value: scopeTotals.sponsor,  color: '#fbbf24' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>{k.label}</div>
                {loading
                  ? <Skeleton w="80%" h={22} />
                  : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: k.color }}>{fmt(k.value)}</div>}
              </div>
            ))}
          </div>

          {/* 월별 수령 추이 차트 */}
          {loading
            ? <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, height: 260 }}/>
            : <MonthlyChart monthly={monthly} selected={month} onSelect={setMonth} />
          }

          {/* 수당 항목별 합산 */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                수당 항목별 합산
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                  {' · '}{month ? monthLong(month) : '전체'}{!loading && ` · ${scopeCount.toLocaleString('ko-KR')}건`}
                </span>
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
                {month ? `${monthLong(month)} 수령 내역이 없습니다` : '수령 내역이 없습니다'}
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
