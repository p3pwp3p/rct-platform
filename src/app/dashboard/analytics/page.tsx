'use client'
import { useEffect, useRef, useState } from 'react'
import { getDashboardData } from '@/lib/db'
import { useProfile } from '@/lib/contexts/ProfileContext'
import type { DashboardData, RankHistoryEntry, DownlineRow } from '@/lib/types'

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

// ─── 월별 누적 하위 매출 시계열 (실데이터) ───────────────────────────────────
// 각 하위 노드의 가입월(created_at) 기준으로, 월말까지 합류한 노드들의 매출을
// 누적 합산 → "현재까지 N개월" 구간의 누적 매출 추이.
function buildMonthlySeries(descendants: DownlineRow[], months: number): { data: number[]; labels: string[]; dates: string[] } {
  const now = new Date()
  const buckets = Array.from({ length: months }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - k), 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const data = buckets.map(({ y, m }) => {
    const nextMonthStart = new Date(y, m + 1, 1).getTime()
    return descendants.reduce((sum, node) => {
      const t = new Date(node.created_at).getTime()
      return t < nextMonthStart ? sum + (node.sales ?? 0) : sum
    }, 0)
  })
  const labels = buckets.map(({ m }) => `${m + 1}월`)
  const dates  = buckets.map(({ y, m }) => `${y}년 ${m + 1}월`)
  return { data, labels, dates }
}

// ─── 캔버스 차트: 월별 매출 추이 (반응형 + hover 툴팁) ───────────────────────
function MonthlyChart({ data, months, dates }: { data: number[]; months: string[]; dates: string[] }) {
  const ref     = useRef<HTMLCanvasElement>(null)
  const geom    = useRef<{ xs: number[]; ys: number[] }>({ xs: [], ys: [] })
  const drawRef = useRef<() => void>(() => {})
  const hoverRef = useRef<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const c = ref.current; if (!c) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w0 = c.offsetWidth, h0 = c.offsetHeight
      if (w0 === 0 || h0 === 0 || data.length === 0) return
      c.width = w0 * dpr; c.height = h0 * dpr
      const ctx = c.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w0, h0)

      const W = w0, H = h0
      // l 키움 + GAP_LABEL 로 Y축 라벨과 그래프 사이 간격 확대
      const PAD = { t: 18, r: 20, b: 44, l: 74 }
      const GAP_LABEL = 18
      const cW = W - PAD.l - PAD.r
      const cH = H - PAD.t - PAD.b
      const maxV = Math.max(...data, 1) * 1.1

      // 가로 그리드 + Y축 라벨
      for (let i = 0; i <= 4; i++) {
        const y = PAD.t + cH - (i / 4) * cH
        ctx.strokeStyle = 'rgba(148,163,184,0.07)'
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cW, y); ctx.stroke()
        ctx.fillStyle = 'rgba(148,163,184,0.45)'
        ctx.font = `11px var(--font-mono, monospace)`
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
        ctx.fillText(fmt(maxV * i / 4 / 1.1), PAD.l - GAP_LABEL, y)
      }

      const n = data.length
      const xs = data.map((_, i) => n === 1 ? PAD.l + cW / 2 : PAD.l + (i / (n - 1)) * cW)
      const ys = data.map(v => PAD.t + cH - (v / maxV) * cH)
      geom.current = { xs, ys }

      const tracePath = () => {
        ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
        for (let i = 1; i < xs.length; i++) {
          const cpx = (xs[i - 1] + xs[i]) / 2
          ctx.bezierCurveTo(cpx, ys[i - 1], cpx, ys[i], xs[i], ys[i])
        }
      }

      // 영역 그라데이션
      const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + cH)
      grad.addColorStop(0, 'rgba(96,165,250,0.26)')
      grad.addColorStop(1, 'rgba(96,165,250,0)')
      tracePath()
      ctx.lineTo(xs[xs.length - 1], PAD.t + cH)
      ctx.lineTo(xs[0], PAD.t + cH)
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill()

      // 라인
      if (n > 1) {
        tracePath()
        ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2.5
        ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
      }

      // hover 세로 가이드라인
      const hv = hoverRef.current
      if (hv != null && xs[hv] != null) {
        ctx.strokeStyle = 'rgba(96,165,250,0.45)'; ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath(); ctx.moveTo(xs[hv], PAD.t); ctx.lineTo(xs[hv], PAD.t + cH); ctx.stroke()
        ctx.setLineDash([])
      }

      // 포인트 (도넛 스타일, hover 시 강조)
      xs.forEach((x, i) => {
        const on = i === hv
        ctx.beginPath(); ctx.arc(x, ys[i], on ? 5.5 : 4, 0, Math.PI * 2)
        ctx.fillStyle = on ? '#60a5fa' : '#0e1117'; ctx.fill()
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#60a5fa'; ctx.stroke()
      })

      // 월 라벨 (X축) — 폰트 키움
      ctx.font = `15px var(--font-main, sans-serif)`
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      const step = n <= 7 ? 1 : 2
      months.forEach((m, i) => {
        if (i % step === 0 || i === n - 1) {
          ctx.fillStyle = i === hv ? '#60a5fa' : 'rgba(148,163,184,0.75)'
          ctx.fillText(m, xs[i], H - 12)
        }
      })
    }

    drawRef.current = draw
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(c)
    return () => ro.disconnect()
  }, [data, months, dates])

  // hover 변동 시 가이드만 다시 그림
  useEffect(() => { drawRef.current() }, [hover])

  const onMove = (e: React.MouseEvent) => {
    const c = ref.current; if (!c) return
    const rect = c.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const { xs } = geom.current
    if (!xs.length) return
    let best = 0, bd = Infinity
    xs.forEach((x, i) => { const d = Math.abs(x - mx); if (d < bd) { bd = d; best = i } })
    hoverRef.current = best
    setHover(best)
  }
  const onLeave = () => { hoverRef.current = null; setHover(null) }

  const g = geom.current
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} onMouseMove={onMove} onMouseLeave={onLeave}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
      {hover != null && g.xs[hover] != null && (
        <div style={{
          position: 'absolute', left: g.xs[hover], top: Math.max(4, g.ys[hover] - 14),
          transform: 'translate(-50%, -100%)', pointerEvents: 'none', zIndex: 5,
          background: 'var(--bg-surface)', border: '1px solid var(--border-secondary)',
          borderRadius: 7, padding: '7px 11px', whiteSpace: 'nowrap',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>{dates[hover]}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#60a5fa' }}>{fmt(data[hover])}</div>
        </div>
      )}
    </div>
  )
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
  const COLS = '28px 1fr 40px 1fr 28px'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* 헤더: LEFT … (중앙) … RIGHT */}
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: '0 8px', marginBottom: 10, alignItems: 'center' }}>
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
          <div key={rank} style={{ display: 'grid', gridTemplateColumns: COLS, gap: '0 8px', alignItems: 'center', padding: '5px 0' }}>
            {/* Left 숫자 — 바 바깥쪽(왼쪽 끝) */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: lc > 0 ? '#60a5fa' : 'var(--text-tertiary)', textAlign: 'right' }}>{lc}</span>
            {/* Left 바 — 중앙(오른쪽)을 향해 채워짐 */}
            <div style={{ height: 7, background: 'var(--bg-inset)', borderRadius: 4, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{
                height: '100%', width: `${(lc / max) * 100}%`,
                background: '#60a5fa', borderRadius: 4,
                transition: 'width 0.6s ease',
                boxShadow: lc > 0 ? '0 0 6px #60a5fa66' : 'none',
              }} />
            </div>
            {/* Rank 라벨 — 중앙 */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color, textAlign: 'center' }}>{rank}</span>
            {/* Right 바 — 중앙(왼쪽)에서 바깥으로 채워짐 */}
            <div style={{ height: 7, background: 'var(--bg-inset)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(rc / max) * 100}%`,
                background: '#a78bfa', borderRadius: 4,
                transition: 'width 0.6s ease',
                boxShadow: rc > 0 ? '0 0 6px #a78bfa66' : 'none',
              }} />
            </div>
            {/* Right 숫자 — 바 바깥쪽(오른쪽 끝) */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: rc > 0 ? '#a78bfa' : 'var(--text-tertiary)', textAlign: 'left' }}>{rc}</span>
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
  const leftSales       = legStats?.left.sales        ?? 0
  const rightSales      = legStats?.right.sales       ?? 0
  const leftTotal       = legStats?.left.total        ?? 0
  const rightTotal      = legStats?.right.total       ?? 0
  const leftActive      = legStats?.left.activeCount  ?? 0
  const rightActive     = legStats?.right.activeCount ?? 0
  const leftTopRank     = legStats?.left.topRank      ?? 'R0'
  const rightTopRank    = legStats?.right.topRank     ?? 'R0'
  const leftLatest      = legStats?.left.latestJoinedAt  ?? null
  const rightLatest     = legStats?.right.latestJoinedAt ?? null
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

  // 월별 차트: 하위 노드 가입월 기준 누적 매출 (실데이터)
  const descendants = dashData?.descendants ?? []
  const periodMonths: Record<typeof activePeriod, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }
  const { data: chartData, labels: chartMonths, dates: chartDates } = buildMonthlySeries(descendants, periodMonths[activePeriod])

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
              누적 매출 · 직급 현황 · 레그 밸런스를 한눈에 확인합니다.
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
                value: loading ? null : fmt(leftTotal),
                sub: leftTotal + rightTotal > 0 ? `전체의 ${((leftTotal / (leftTotal + rightTotal)) * 100).toFixed(1)}%` : '노드 없음',
                color: '#60a5fa',
                isMono: true,
              },
              {
                label: 'Right Leg',
                value: loading ? null : fmt(rightTotal),
                sub: leftTotal + rightTotal > 0 ? `전체의 ${((rightTotal / (leftTotal + rightTotal)) * 100).toFixed(1)}%` : '노드 없음',
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
              {loading
                ? <Sk w="100%" h={180} r={8} />
                : <MonthlyChart data={chartData} months={chartMonths} dates={chartDates} />}
            </div>
          </div>

          {/* 레그 밸런스 + 하위 분포 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <div className="an-card">
              <div className="an-card-title">Leg 밸런스 (노드 수)</div>
              <LegBalanceBar left={leftTotal} right={rightTotal} />
              <div style={{
                marginTop: 16, padding: '10px 14px',
                background: 'var(--bg-inset)', borderRadius: 6,
                border: '1px solid var(--border-primary)',
              }}>
                {leftTotal > rightTotal * 1.4 ? (
                  <p style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#fbbf24', margin: 0, lineHeight: 1.6 }}>
                    ⚠ Right Leg &lt; Left Leg ({rightTotal > 0 ? ((leftTotal / rightTotal - 1) * 100).toFixed(0) : '∞'}% 차이) — Right Leg 강화를 권장합니다.
                  </p>
                ) : rightTotal > leftTotal * 1.4 ? (
                  <p style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#fbbf24', margin: 0, lineHeight: 1.6 }}>
                    ⚠ Left Leg &lt; Right Leg ({leftTotal > 0 ? ((rightTotal / leftTotal - 1) * 100).toFixed(0) : '∞'}% 차이) — Left Leg 강화를 권장합니다.
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

          {/* L / R 레그 상세 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {([
              { label: 'LEFT LEG',  color: '#60a5fa', total: leftTotal,  active: leftActive,  topRank: leftTopRank  as RankKey, sales: leftSales,  latest: leftLatest  },
              { label: 'RIGHT LEG', color: '#a78bfa', total: rightTotal, active: rightActive, topRank: rightTopRank as RankKey, sales: rightSales, latest: rightLatest },
            ]).map(leg => (
              <div key={leg.label} className="an-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: leg.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: leg.color }}>{leg.label}</span>
                </div>
                {/* 총 / 활성 노드 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--bg-inset)', borderRadius: 7, padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>총 노드</div>
                    {loading
                      ? <Sk w={36} h={20} />
                      : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: leg.color }}>{leg.total}</span>
                    }
                  </div>
                  <div style={{ background: 'var(--bg-inset)', borderRadius: 7, padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>활성 노드</div>
                    {loading
                      ? <Sk w={36} h={20} />
                      : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#34d399' }}>{leg.active}</span>
                    }
                  </div>
                </div>
                {/* 최고 직급 / 평균 매출 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--bg-inset)', borderRadius: 7, padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>최고 직급</div>
                    {loading
                      ? <Sk w={36} h={20} />
                      : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: RANK_COLOR[leg.topRank] }}>{leg.topRank}</span>
                    }
                  </div>
                  <div style={{ background: 'var(--bg-inset)', borderRadius: 7, padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>평균 노드 매출</div>
                    {loading
                      ? <Sk w={48} h={20} />
                      : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {leg.total > 0 ? fmt(Math.round(leg.sales / leg.total)) : '—'}
                        </span>
                    }
                  </div>
                </div>
                {/* 최근 가입 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border-primary)' }}>
                  <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>최근 가입일</span>
                  {loading
                    ? <Sk w={80} h={12} />
                    : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {leg.latest ? leg.latest.slice(0, 10) : '—'}
                      </span>
                  }
                </div>
              </div>
            ))}
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
