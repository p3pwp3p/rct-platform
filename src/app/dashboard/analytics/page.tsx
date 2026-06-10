'use client'
import { useEffect, useRef, useState } from 'react'
import { getDashboardData } from '@/lib/db'
import { useProfile } from '@/lib/contexts/ProfileContext'
import type { DashboardData, RankHistoryEntry } from '@/lib/types'

// ─── 직급 상수 ───────────────────────────────────────────────────────────────
const RANK_ORDER = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'] as const
type RankKey = typeof RANK_ORDER[number]

const RANK_COLOR: Record<RankKey, string> = {
  'R0': '#64748b', 'R1': '#34d399', 'R2': '#60a5fa',
  'R3': '#fbbf24',     'R4': '#f97316', 'R5': '#a78bfa',
}

// ─── 직급 달성 조건 (rank-check/route.ts 와 동일하게 유지) ──────────────────
// legTotal  : A/B 각 레그 총 멤버 수 (R0→R1)
// legRank   : A/B 각 레그에서 해당 rank 이상 보유자 수 (R1→R5)
type RankReq =
  | { direct: number; legTotal: number }
  | { direct: number; legRank: { rank: RankKey; count: number } }
  | null

const RANK_REQ: Record<RankKey, RankReq> = {
  'R0': { direct: 3,  legTotal: 10 },
  'R1': { direct: 5,  legRank: { rank: 'R1', count: 2 } },
  'R2': { direct: 8,  legRank: { rank: 'R2', count: 2 } },
  'R3': { direct: 15, legRank: { rank: 'R3', count: 2 } },
  'R4': { direct: 20, legRank: { rank: 'R4', count: 2 } },
  'R5': null,
}

function reqSummary(rank: RankKey): string {
  const req = RANK_REQ[rank]
  if (!req) return '최고 직급'
  if ('legTotal' in req) return `직추천 ${req.direct} · L/R 각 ${req.legTotal}명`
  return `직추천 ${req.direct} · L/R 각 ${req.legRank.rank} 이상 ${req.legRank.count}명`
}

function nextRank(rank: RankKey): RankKey | null {
  const idx = RANK_ORDER.indexOf(rank)
  return idx < RANK_ORDER.length - 1 ? RANK_ORDER[idx + 1] : null
}
function fmt(n: number) {
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
}

// ─── 캔버스 차트: 월별 매출 추이 ─────────────────────────────────────────────
function MonthlyChart({ data, months }: { data: number[]; months: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current; if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w0 = c.offsetWidth, h0 = c.offsetHeight
    c.width = w0 * dpr; c.height = h0 * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    const W = w0, H = h0
    const PAD = { t: 16, r: 16, b: 32, l: 52 }
    const cW = W - PAD.l - PAD.r
    const cH = H - PAD.t - PAD.b
    const maxV = Math.max(...data) * 1.1

    ctx.strokeStyle = 'rgba(148,163,184,0.07)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = PAD.t + cH - (i / 4) * cH
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cW, y); ctx.stroke()
      ctx.fillStyle = 'rgba(148,163,184,0.35)'
      ctx.font = `10px var(--font-mono, monospace)`
      ctx.textAlign = 'right'
      ctx.fillText(fmt(maxV * i / 4 / 1.1), PAD.l - 6, y + 4)
    }

    const xs = data.map((_, i) => PAD.l + (i / (data.length - 1)) * cW)
    const ys = data.map(v  => PAD.t + cH - (v / maxV) * cH)

    const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + cH)
    grad.addColorStop(0, 'rgba(96,165,250,0.22)')
    grad.addColorStop(1, 'rgba(96,165,250,0)')
    ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
    for (let i = 1; i < xs.length; i++) {
      const cpx = (xs[i - 1] + xs[i]) / 2
      ctx.bezierCurveTo(cpx, ys[i - 1], cpx, ys[i], xs[i], ys[i])
    }
    ctx.lineTo(xs[xs.length - 1], PAD.t + cH)
    ctx.lineTo(xs[0], PAD.t + cH)
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill()

    ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
    for (let i = 1; i < xs.length; i++) {
      const cpx = (xs[i - 1] + xs[i]) / 2
      ctx.bezierCurveTo(cpx, ys[i - 1], cpx, ys[i], xs[i], ys[i])
    }
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2; ctx.stroke()

    xs.forEach((x, i) => {
      ctx.beginPath(); ctx.arc(x, ys[i], 3, 0, Math.PI * 2)
      ctx.fillStyle = '#60a5fa'; ctx.fill()
    })

    ctx.fillStyle = 'rgba(148,163,184,0.4)'
    ctx.font = `10px var(--font-main, sans-serif)`
    ctx.textAlign = 'center'
    months.forEach((m, i) => {
      if (i % 2 === 0) ctx.fillText(m, xs[i], H - 8)
    })
  }, [data, months])

  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ─── 레그 밸런스 바 ─────────────────────────────────────────────────────────
function LegBalanceBar({ left, right }: { left: number; right: number }) {
  const total = left + right
  const lPct  = total > 0 ? (left / total) * 100 : 50
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-inset)' }}>
        <div style={{ width: `${lPct}%`, background: '#60a5fa', transition: 'width 0.6s ease' }} />
        <div style={{ flex: 1,           background: '#a78bfa' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#60a5fa', letterSpacing: '0.08em' }}>LEFT LEG</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>{fmt(left)}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
            {lPct.toFixed(1)}% / {(100 - lPct).toFixed(1)}%
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#a78bfa', letterSpacing: '0.08em' }}>RIGHT LEG</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#a78bfa' }}>{fmt(right)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── 조건 달성 게이지 행 ─────────────────────────────────────────────────────
function CondRow({ label, cur, need, color, labelColor }: {
  label: string; cur: number; need: number; color: string; labelColor?: string
}) {
  const pct  = need > 0 ? Math.min(1, cur / need) : 1
  const done = pct >= 1
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: labelColor ?? 'var(--text-secondary)' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: done ? '#34d399' : 'var(--text-primary)' }}>
            {cur}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-tertiary)' }}>/ {need}</span>
          {done && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
        </div>
      </div>
      <div style={{ height: 5, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`, borderRadius: 2,
          background: done
            ? 'linear-gradient(90deg,#34d39977,#34d399)'
            : `linear-gradient(90deg,${color}55,${color})`,
          transition: 'width 0.8s ease',
          boxShadow: `0 0 5px ${done ? '#34d39944' : color + '44'}`,
        }} />
      </div>
      {!done && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'right' }}>
          {need - cur} remaining
        </div>
      )}
    </div>
  )
}

// ─── 직급 분포 차트 (Left / Right 분리) ─────────────────────────────────────
function DistributionChart({
  left, right,
}: {
  left:  { rank: RankKey; count: number }[]
  right: { rank: RankKey; count: number }[]
}) {
  const max = Math.max(...left.map(d => d.count), ...right.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 28px 1fr 28px', gap: '0 6px', marginBottom: 8, alignItems: 'center' }}>
        <div />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#60a5fa', textAlign: 'center' }}>Left</div>
        <div />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a78bfa', textAlign: 'center' }}>Right</div>
        <div />
      </div>
      {RANK_ORDER.map((rank, i) => {
        const lc = left[i].count
        const rc = right[i].count
        const color = RANK_COLOR[rank]
        return (
          <div key={rank} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 28px 1fr 28px', gap: '0 6px', alignItems: 'center', padding: '4px 0' }}>
            {/* Rank 라벨 */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, textAlign: 'center' }}>{rank}</span>
            {/* Left 바 (오른쪽 정렬) */}
            <div style={{ height: 6, background: 'var(--bg-inset)', borderRadius: 3, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{
                height: '100%', width: `${(lc / max) * 100}%`,
                background: '#60a5fa', borderRadius: 3,
                transition: 'width 0.6s ease',
                boxShadow: lc > 0 ? '0 0 6px #60a5fa66' : 'none',
              }} />
            </div>
            {/* Left 숫자 */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: lc > 0 ? '#60a5fa' : 'var(--text-tertiary)', textAlign: 'center' }}>{lc}</span>
            {/* Right 바 */}
            <div style={{ height: 6, background: 'var(--bg-inset)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(rc / max) * 100}%`,
                background: '#a78bfa', borderRadius: 3,
                transition: 'width 0.6s ease',
                boxShadow: rc > 0 ? '0 0 6px #a78bfa66' : 'none',
              }} />
            </div>
            {/* Right 숫자 */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: rc > 0 ? '#a78bfa' : 'var(--text-tertiary)', textAlign: 'center' }}>{rc}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── 스켈레톤 ────────────────────────────────────────────────────────────────
function Sk({ w = '100%', h = 14, r = 4 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, var(--bg-inset) 25%, var(--border-primary) 50%, var(--bg-inset) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { activeProfile, loading: profileLoading } = useProfile()
  const [activePeriod, setActivePeriod] = useState<'1M' | '3M' | '6M' | '1Y'>('1Y')
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (profileLoading) return
    if (!activeProfile) { setLoading(false); return }
    setLoading(true)
    setDashData(null)
    getDashboardData(activeProfile.id)
      .then(d => setDashData(d))
      .catch(e => console.error('[analytics]', e))
      .finally(() => setLoading(false))
  }, [activeProfile?.id, profileLoading])

  const profile    = dashData?.profile
  const legStats   = dashData?.legStats
  const rankHistory: RankHistoryEntry[] = dashData?.rankHistory ?? []

  const myRank     = (profile?.rank ?? 'R0') as RankKey
  const color      = RANK_COLOR[myRank]
  const next       = nextRank(myRank)
  const leftSales  = legStats?.left.sales  ?? 0
  const rightSales = legStats?.right.sales ?? 0
  const leftTotal  = legStats?.left.total  ?? 0
  const rightTotal = legStats?.right.total ?? 0
  const direct     = legStats?.directReferrals ?? 0

  // 다운라인 직급 분포: left / right 분리
  const leftDist  = RANK_ORDER.map(rank => ({ rank, count: legStats?.left.rankCounts[rank]  ?? 0 }))
  const rightDist = RANK_ORDER.map(rank => ({ rank, count: legStats?.right.rankCounts[rank] ?? 0 }))
  const totalDownline = leftDist.reduce((a, b) => a + b.count, 0) + rightDist.reduce((a, b) => a + b.count, 0)

  // 다음 직급 달성에 필요한 각 leg 인원 수
  // legRank 조건: 해당 rank 이상(≥) 합산 (rank-check 서버 로직과 동일)
  const reqForNext = next ? RANK_REQ[next] : null
  const legRankKey = reqForNext && 'legRank' in reqForNext ? reqForNext.legRank.rank : null

  // rankCounts는 각 rank "정확히" 의 카운트 — ≥ 조건으로 합산
  const sumRankGte = (counts: Record<string, number>, minRank: string) => {
    const minIdx = RANK_ORDER.indexOf(minRank)
    return RANK_ORDER.slice(minIdx).reduce((s, r) => s + (counts[r] ?? 0), 0)
  }
  const leftLegRankCount = legRankKey
    ? sumRankGte(legStats?.left.rankCounts  ?? {}, legRankKey) : 0
  const rightLegRankCount = legRankKey
    ? sumRankGte(legStats?.right.rankCounts ?? {}, legRankKey) : 0

  // 월별 차트: 아직 DB에 시계열 데이터 없으므로 현재 총 매출 기준 시뮬레이션
  const totalSales = leftSales + rightSales
  const MONTHLY = loading
    ? [18, 24, 31, 27, 38, 43, 52, 48, 61, 74, 68, 87].map(v => v * 1000)
    : Array.from({ length: 12 }, (_, i) => Math.round(totalSales * (0.4 + 0.6 * (i + 1) / 12)))
  const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

  const periodSlice: Record<typeof activePeriod, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }
  const sliceCount  = periodSlice[activePeriod]
  const chartData   = MONTHLY.slice(-sliceCount)
  const chartMonths = MONTHS.slice(-sliceCount)

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .an-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-primary);
          border-radius: 10px;
          padding: 20px;
        }
        .an-card-title {
          font-family: var(--font-main);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--text-tertiary);
          margin-bottom: 14px;
        }
        .an-period-btn {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 3px 10px;
          border-radius: 4px;
          border: 1px solid var(--border-secondary);
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.05em;
        }
        .an-period-btn:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
        .an-period-btn.active {
          background: var(--accent-blue-dim);
          border-color: var(--accent-blue);
          color: var(--accent-blue);
        }
        .an-kpi {
          background: var(--bg-surface);
          border: 1px solid var(--border-primary);
          border-radius: 10px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .an-history-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border-primary);
        }
        .an-history-item:last-child { border-bottom: none; }
        .an-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(148,163,184,0.12) transparent;
        }
        .an-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .an-scroll::-webkit-scrollbar-track { background: transparent; }
        .an-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.12); border-radius: 2px; }
        .an-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.28); }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', height: '100%', overflow: 'hidden' }}>

        {/* ── 메인 콘텐츠 ── */}
        <main className="an-scroll" style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <h1 style={{ fontFamily: 'var(--font-main)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              성과 분석
            </h1>
            <p style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>
              내 바이너리 네트워크의 누적 매출 · 직급 현황 · 레그 밸런스를 확인합니다.
            </p>
          </div>

          {/* KPI 카드 4개 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[
              {
                label: '역대 하위 매출',
                value: loading ? null : fmt(leftSales + rightSales),
                sub: '누적 총합',
                color,
                isKorean: false,
              },
              {
                label: '현재 직급',
                value: loading ? null : myRank,
                sub: next ? `다음: ${next}` : '최고 직급',
                color,
                isKorean: myRank === 'R0',
              },
              {
                label: 'Left Leg',
                value: loading ? null : fmt(leftSales),
                sub: leftSales + rightSales > 0 ? `${((leftSales / (leftSales + rightSales)) * 100).toFixed(1)}%` : '0%',
                color: '#60a5fa',
                isMono: true,
              },
              {
                label: 'Right Leg',
                value: loading ? null : fmt(rightSales),
                sub: leftSales + rightSales > 0 ? `${((rightSales / (leftSales + rightSales)) * 100).toFixed(1)}%` : '0%',
                color: '#a78bfa',
                isMono: true,
              },
            ].map(k => (
              <div key={k.label} className="an-kpi">
                <span style={{ fontFamily: (k as {isMono?: boolean}).isMono ? 'var(--font-mono)' : 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: (k as {isMono?: boolean}).isMono ? '0.06em' : '0.02em' }}>
                  {k.label}
                </span>
                {k.value === null
                  ? <Sk w="60%" h={24} />
                  : <span style={{ fontFamily: k.isKorean ? 'var(--font-main)' : 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: k.color, lineHeight: 1.1 }}>
                      {k.value}
                    </span>
                }
                <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {k.sub}
                </span>
              </div>
            ))}
          </div>

          {/* 월별 매출 추이 차트 */}
          <div className="an-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="an-card-title" style={{ marginBottom: 0 }}>월별 하위 매출 추이</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['1M', '3M', '6M', '1Y'] as const).map(p => (
                  <button
                    key={p}
                    className={`an-period-btn${activePeriod === p ? ' active' : ''}`}
                    onClick={() => setActivePeriod(p)}
                  >{p}</button>
                ))}
              </div>
            </div>
            <div style={{ height: 180 }}>
              <MonthlyChart data={chartData} months={chartMonths} />
            </div>
          </div>

          {/* 레그 밸런스 + 하위 분포 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <div className="an-card">
              <div className="an-card-title">Leg 밸런스</div>
              <LegBalanceBar left={leftSales} right={rightSales} />
              <div style={{
                marginTop: 16, padding: '10px 14px',
                background: 'var(--bg-inset)', borderRadius: 6,
                border: '1px solid var(--border-primary)',
              }}>
                {leftSales > rightSales * 1.4 ? (
                  <p style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#fbbf24', margin: 0, lineHeight: 1.6 }}>
                    ⚠ Right Leg &lt; Left Leg ({rightSales > 0 ? ((leftSales / rightSales - 1) * 100).toFixed(0) : '∞'}% 차이) — Right Leg 강화를 권장합니다.
                  </p>
                ) : rightSales > leftSales * 1.4 ? (
                  <p style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#fbbf24', margin: 0, lineHeight: 1.6 }}>
                    ⚠ Left Leg &lt; Right Leg ({leftSales > 0 ? ((rightSales / leftSales - 1) * 100).toFixed(0) : '∞'}% 차이) — Left Leg 강화를 권장합니다.
                  </p>
                ) : (
                  <p style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#34d399', margin: 0, lineHeight: 1.6 }}>
                    ✓ Left Leg ≈ Right Leg — Leg 밸런스가 양호합니다.
                  </p>
                )}
              </div>
            </div>

            <div className="an-card">
              <div className="an-card-title">하위 노드 직급 분포</div>
              <DistributionChart left={leftDist} right={rightDist} />
              <div style={{
                marginTop: 16, display: 'flex', justifyContent: 'space-between',
                padding: '10px 0', borderTop: '1px solid var(--border-primary)',
              }}>
                <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  전체 하위 노드
                </span>
                {loading
                  ? <Sk w={40} h={14} />
                  : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {totalDownline}
                    </span>
                }
              </div>
            </div>
          </div>

          {/* 직급 변동 히스토리 */}
          <div className="an-card">
            <div className="an-card-title">직급 변동 히스토리</div>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[0,1,2].map(i => <Sk key={i} w="100%" h={36} r={6} />)}
              </div>
            )}
            {!loading && rankHistory.length === 0 && (
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0' }}>
                아직 직급 변동 기록이 없습니다.
              </div>
            )}
            {!loading && rankHistory.length > 0 && (
              <div>
                {rankHistory.map((h, i) => (
                  <div key={i} className="an-history-item">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', width: 90, flexShrink: 0 }}>
                      {h.changed_at?.slice(0, 10)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13, fontWeight: 600,
                        color: RANK_COLOR[h.old_rank as RankKey] ?? 'var(--text-secondary)',
                      }}>{h.old_rank}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13, fontWeight: 700,
                        color: RANK_COLOR[h.new_rank as RankKey] ?? 'var(--text-secondary)',
                      }}>{h.new_rank}</span>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-main)', fontSize: 11,
                      color: '#34d399', background: 'rgba(52,211,153,0.1)',
                      border: '1px solid rgba(52,211,153,0.3)',
                      padding: '2px 8px', borderRadius: 6,
                    }}>승급</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* ── 우측 사이드바 ── */}
        <aside className="an-scroll" style={{
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-primary)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          <div style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.14em',
            color: 'var(--text-tertiary)',
            flexShrink: 0,
          }}>
            Performance Panel
          </div>

          <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 현재 직급 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>현재 직급</div>
                {loading
                  ? <Sk w={52} h={24} />
                  : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color }}>{myRank}</span>
                }
              </div>
              {next && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>다음 직급</div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: RANK_COLOR[next] }}>{next}</span>
                </div>
              )}
            </div>

            {/* 다음 직급 달성 조건 — 하나의 카드로 통합 */}
            {next && reqForNext && (() => {
              const nextColor = RANK_COLOR[next]

              if ('legTotal' in reqForNext) {
                return (
                  <div style={{ background: 'var(--bg-inset)', border: `1px solid ${nextColor}33`, borderRadius: 8, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, color: nextColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                      {next} 달성 조건
                    </div>
                    <CondRow label="직추천" cur={direct} need={reqForNext.direct} color={nextColor} />
                    <CondRow label="Left Leg 총 인원" cur={leftTotal}  need={reqForNext.legTotal} color="#60a5fa" labelColor="#60a5fa" />
                    <CondRow label="Right Leg 총 인원" cur={rightTotal} need={reqForNext.legTotal} color="#a78bfa" labelColor="#a78bfa" />
                  </div>
                )
              }

              const { rank: reqRank, count } = reqForNext.legRank
              const reqRankColor = RANK_COLOR[reqRank]
              return (
                <div style={{ background: 'var(--bg-inset)', border: `1px solid ${nextColor}33`, borderRadius: 8, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, color: nextColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {next} 달성 조건
                    </span>
                    <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      각 라인
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: reqRankColor,
                        background: reqRankColor + '18', border: `1px solid ${reqRankColor}44`,
                        padding: '1px 6px', borderRadius: 3,
                      }}>{reqRank}</span>
                      {count}+
                    </span>
                  </div>
                  <CondRow label="직추천" cur={direct} need={reqForNext.direct} color={nextColor} />
                  <CondRow label="Left Leg"  cur={leftLegRankCount}  need={count} color="#60a5fa" labelColor="#60a5fa" />
                  <CondRow label="Right Leg" cur={rightLegRankCount} need={count} color="#a78bfa" labelColor="#a78bfa" />
                </div>
              )
            })()}

            <div style={{ borderTop: '1px solid var(--border-primary)' }} />

            {/* 전체 직급 로드맵 */}
            <div>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16 }}>직급 로드맵</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {RANK_ORDER.map((rank, idx) => {
                  const isCurrentOrPast = idx <= RANK_ORDER.indexOf(myRank)
                  const isCurrent = rank === myRank
                  // 이 직급에 도달하기 위한 조건 = 이전 직급의 RANK_REQ
                  const prevRank = idx > 0 ? RANK_ORDER[idx - 1] : null
                  const condText = prevRank ? reqSummary(prevRank) : '시작 직급'
                  return (
                    <div key={rank} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '9px 12px', borderRadius: 7,
                      background: isCurrent ? `${RANK_COLOR[rank]}12` : 'transparent',
                      border: isCurrent ? `1px solid ${RANK_COLOR[rank]}44` : '1px solid transparent',
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isCurrentOrPast ? RANK_COLOR[rank] : 'var(--bg-inset)',
                        border: `2px solid ${isCurrentOrPast ? RANK_COLOR[rank] : 'var(--border-secondary)'}`,
                      }}>
                        {isCurrentOrPast && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 14, fontWeight: isCurrent ? 700 : 500,
                        color: isCurrentOrPast ? RANK_COLOR[rank] : 'var(--text-tertiary)',
                        flex: 1,
                      }}>{rank}</span>
                      <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                        {condText}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
