'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { adminGetAllProfiles } from '@/lib/db-admin'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'
import type { Profile, ProfitReport, ProfitReportItem } from '@/lib/types'

const RANK_COLOR: Record<string, string> = {
  R0: '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}
const RANK_ORDER = ['R0','R1','R2','R3','R4','R5']
const COMPANY_RATIO = 0.20
const MEMBER_RATIO  = 0.80

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function Skeleton({ w = '60%', h = 16 }: { w?: string; h?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 4, background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.07) 50%,var(--bg-inset) 75%)', backgroundSize: '200% 100%', animation: 'sk 1.4s infinite' }}/>
  )
}

// ── KPI 카드 ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, subColor = '#4db6ac', icon, accent, loading }: {
  label: string; value: string; sub?: string; subColor?: string
  icon: React.ReactNode; accent?: string; loading?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  if (loading) return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton w="50%" h={12}/><Skeleton w="70%" h={28}/>
    </div>
  )
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: 'var(--bg-surface)', border: `1px solid ${hovered && accent ? accent + '60' : 'var(--border-primary)'}`, borderRadius: 12, padding: '20px', position: 'relative', overflow: 'hidden', transform: hovered ? 'translateY(-2px)' : 'none', boxShadow: hovered ? '0 10px 25px -5px rgba(0,0,0,0.5)' : 'none', transition: 'all 0.2s ease', cursor: 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
        <div style={{ padding: 6, borderRadius: 6, background: (accent ?? '#4db6ac') + '18', color: accent ?? '#4db6ac', display: 'flex' }}>{icon}</div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{value}</div>
      {sub && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: subColor, fontFamily: 'var(--font-main)', fontWeight: 500 }}>{sub}</div>}
      {accent && <div style={{ position: 'absolute', right: -24, bottom: -24, width: 96, height: 96, background: accent, opacity: 0.03, borderRadius: '50%', filter: 'blur(20px)', pointerEvents: 'none' }}/>}
    </div>
  )
}

// ── 인터랙티브 월별 매출 차트 ─────────────────────────────────────────────────
type MonthPoint = { label: string; value: number }

function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning    = useRef(false)
  const lastX        = useRef(0)

  // zoom: 한 화면에 보이는 포인트 수 (최소 3, 최대 전체)
  const [visibleCount, setVisibleCount] = useState(0)  // 0 = 전체
  const [panStart, setPanStart]         = useState(0)   // 시작 인덱스
  const [tooltip, setTooltip]           = useState<{ i: number; x: number; y: number } | null>(null)

  // 컨테이너 실제 폭을 측정해 viewBox와 1:1 매핑 → 왜곡 제거
  const [W, setW] = useState(840)
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const measure = () => setW(Math.max(320, el.clientWidth - 40))
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const total = data.length
  const visible = visibleCount === 0 ? total : Math.max(3, Math.min(visibleCount, total))
  const startIdx = Math.max(0, Math.min(panStart, total - visible))
  const slice    = data.slice(startIdx, startIdx + visible)

  const maxVal  = Math.max(...slice.map(d => d.value), 1)
  const H = 220, PAD_L = 56, PAD_R = 20, PAD_T = 14, PAD_B = 44
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B

  const pts = slice.map((d, i) => ({
    x: PAD_L + (slice.length === 1 ? plotW / 2 : (i / (slice.length - 1)) * plotW),
    y: PAD_T + plotH - (d.value / maxVal) * plotH,
    ...d,
  }))

  // smooth bezier path
  function makePath(pts: { x: number; y: number }[]) {
    if (pts.length === 0) return ''
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const cp1x = pts[i-1].x + (pts[i].x - pts[i-1].x) * 0.4
      const cp1y = pts[i-1].y
      const cp2x = pts[i].x - (pts[i].x - pts[i-1].x) * 0.4
      const cp2y = pts[i].y
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pts[i].x} ${pts[i].y}`
    }
    return d
  }

  // 단일 포인트는 양 끝을 같은 y로 펼쳐 평탄한 라인/영역으로 렌더 (삼각형 아티팩트 방지)
  const linePts = pts.length === 1
    ? [{ ...pts[0], x: PAD_L }, { ...pts[0], x: W - PAD_R }]
    : pts
  const linePath = makePath(linePts)
  const areaPath = linePath
    ? linePath + ` L ${linePts[linePts.length-1].x} ${PAD_T + plotH} L ${linePts[0].x} ${PAD_T + plotH} Z`
    : ''

  // y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD_T + plotH - f * plotH,
    label: fmt(maxVal * f),
  }))

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 1 : -1
    setVisibleCount(prev => {
      const cur = prev === 0 ? total : prev
      const next = Math.max(3, Math.min(total, cur + delta * Math.ceil(cur * 0.15)))
      return next >= total ? 0 : next
    })
  }, [total])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isPanning.current = true
    lastX.current = e.clientX
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current || !containerRef.current) return
    const dx = e.clientX - lastX.current
    lastX.current = e.clientX
    const rect = containerRef.current.getBoundingClientRect()
    const pxPerStep = rect.width / visible
    if (Math.abs(dx) > pxPerStep / 2) {
      const step = dx > 0 ? -1 : 1
      setPanStart(prev => Math.max(0, Math.min(total - visible, prev + step)))
      lastX.current = e.clientX
    }
  }, [visible, total])

  const handleMouseUp = useCallback(() => { isPanning.current = false }, [])

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning.current || pts.length === 0) { setTooltip(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = (e.clientX - rect.left) / rect.width * W
    let closest = 0
    let minDist = Infinity
    pts.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < minDist) { minDist = d; closest = i } })
    if (minDist < plotW / (pts.length * 1.5)) {
      setTooltip({ i: closest, x: pts[closest].x, y: pts[closest].y })
    } else {
      setTooltip(null)
    }
  }, [pts, plotW])

  const isEmpty = data.length === 0

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>월별 매출 추이</div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>
            {isEmpty ? '정산 보고서 데이터 없음' : `${total}개 구간 · 휠 확대/축소 · 드래그 이동`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isEmpty && visibleCount !== 0 && (
            <button onClick={() => { setVisibleCount(0); setPanStart(0) }}
              style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'var(--font-main)', borderRadius: 4, border: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
              전체
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4db6ac' }}/>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-secondary)' }}>총 매출</span>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div ref={containerRef} style={{ padding: '16px 20px 0', position: 'relative', minHeight: 240, userSelect: 'none', cursor: isPanning.current ? 'grabbing' : (isEmpty ? 'default' : 'grab') }}
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>

        {isEmpty ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, flexDirection: 'column', gap: 10 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>정산 보고서를 업로드하면 차트가 표시됩니다</span>
          </div>
        ) : (
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible', display: 'block' }}
            onMouseMove={handleSvgMouseMove} onMouseLeave={() => setTooltip(null)}>
            <defs>
              <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(77,182,172,0.3)"/>
                <stop offset="100%" stopColor="rgba(77,182,172,0)"/>
              </linearGradient>
            </defs>

            {/* Y축 눈금선 */}
            {yTicks.map(t => (
              <g key={t.y}>
                <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray={t.label === '0' ? undefined : '3 3'} opacity={0.6}/>
                <text x={PAD_L - 6} y={t.y + 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-tertiary)">{t.label}</text>
              </g>
            ))}

            {/* 베이스라인 */}
            <line x1={PAD_L} y1={PAD_T + plotH} x2={W - PAD_R} y2={PAD_T + plotH} stroke="var(--border-primary)" strokeWidth="1"/>

            {/* 영역 + 라인 */}
            {areaPath && <path d={areaPath} fill="url(#mg)"/>}
            {linePath  && <path d={linePath}  fill="none" stroke="#4db6ac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}

            {/* 포인트 */}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={tooltip?.i === i ? 5 : 3}
                fill={tooltip?.i === i ? '#4db6ac' : 'var(--bg-surface)'}
                stroke="#4db6ac" strokeWidth="2"
                style={{ transition: 'r 0.1s' }}/>
            ))}

            {/* X축 라벨 — PAD_B 안에 여유 */}
            {pts.map((p, i) => {
              const isLast = startIdx + i === total - 1
              return (
                <text key={i} x={p.x} y={PAD_T + plotH + 22} textAnchor="middle"
                  fontFamily="var(--font-mono)" fontSize="9"
                  fill={isLast ? '#4db6ac' : 'var(--text-tertiary)'}
                  fontWeight={isLast ? '700' : '400'}>
                  {p.label}
                </text>
              )
            })}

            {/* 툴팁 */}
            {tooltip && pts[tooltip.i] && (() => {
              const p = pts[tooltip.i]
              const bx = Math.min(p.x - 4, W - PAD_R - 80)
              return (
                <g>
                  <line x1={p.x} y1={PAD_T} x2={p.x} y2={PAD_T + plotH} stroke="#4db6ac" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
                  <rect x={bx} y={p.y - 34} width={76} height={28} rx="4" fill="var(--bg-inset)" stroke="#4db6ac" strokeWidth="0.8"/>
                  <text x={bx + 6} y={p.y - 22} fontFamily="var(--font-mono)" fontSize="8" fill="var(--text-tertiary)">{slice[tooltip.i].label}</text>
                  <text x={bx + 6} y={p.y - 12} fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" fill="var(--text-primary)">{fmt(slice[tooltip.i].value)}</text>
                </g>
              )
            })()}
          </svg>
        )}
      </div>
      {/* X축 아래 여백 */}
      <div style={{ height: 16 }}/>
    </div>
  )
}

// ── 레그별 매출 막대 (실 데이터) ──────────────────────────────────────────────
type LegMonth = { label: string; left: number; right: number }

function LegBarChart({ profiles, legMonths }: { profiles: Profile[]; legMonths: LegMonth[] }) {
  const leftSales  = profiles.filter(p => p.leg_position === 'LEFT').reduce((s,p) => s + p.sales, 0)
  const rightSales = profiles.filter(p => p.leg_position === 'RIGHT').reduce((s,p) => s + p.sales, 0)
  const total = leftSales + rightSales || 1
  const leftPct  = Math.round(leftSales  / total * 100)
  const rightPct = Math.round(rightSales / total * 100)

  // legMonths가 있으면 실 데이터, 없으면 현재 단일 바
  const months: LegMonth[] = legMonths.length > 0 ? legMonths.slice(-6) : [{ label: 'NOW', left: leftPct, right: rightPct }]
  const maxVal = Math.max(...months.flatMap(m => [m.left, m.right]), 1)

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>레그별 매출 현황</div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { color: '#3b82f6', label: `Left · ${fmt(leftSales)}` },
            { color: '#a78bfa', label: `Right · ${fmt(rightSales)}` },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-main)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }}/>
              {l.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 180, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: 28 }}>
        {/* 가로 눈금선 */}
        <div style={{ position: 'absolute', inset: '0 0 28px 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width: '100%', borderTop: '1px dashed var(--border-primary)' }}/>)}
        </div>

        {months.map(({ label, left, right }) => {
          const lh = (left  / maxVal) * 100
          const rh = (right / maxVal) * 100
          const isLast = months.length > 1 && label === months[months.length - 1].label
          return (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: 36, height: '100%', position: 'relative', zIndex: 1 }}>
              {/* inner row 에 height:100% 필수 — 자식 막대의 %높이가 이 높이를 기준으로 계산됨 */}
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                <div style={{ flex: 1, background: '#3b82f6', borderRadius: '2px 2px 0 0', height: `${lh}%`, boxShadow: isLast ? '0 0 10px rgba(59,130,246,0.3)' : 'none', transition: 'height 0.4s ease' }}/>
                <div style={{ flex: 1, background: '#a78bfa', borderRadius: '2px 2px 0 0', height: `${rh}%`, boxShadow: isLast ? '0 0 10px rgba(139,92,246,0.3)' : 'none', transition: 'height 0.4s ease' }}/>
              </div>
              {/* 라벨 — 바 아래 충분한 여백 */}
              <div style={{ position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: 9, color: isLast ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: isLast ? 700 : 400, whiteSpace: 'nowrap' }}>
                {label}
              </div>
            </div>
          )
        })}
      </div>

      {legMonths.length === 0 && (
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
          정산 보고서 업로드 후 월별 이력이 표시됩니다
        </div>
      )}
    </div>
  )
}

// ── 매출 구성 도넛 ────────────────────────────────────────────────────────────
function PieCard({ compSales, memSales, totalSales }: { compSales: number; memSales: number; totalSales: number }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>매출 구성 (P/F)</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 160 }}>
        <div style={{ position: 'relative', width: 160, height: 160 }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border-primary)" strokeWidth="3"/>
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" stroke="#a78bfa" strokeWidth="4" strokeDasharray={`${MEMBER_RATIO * 100} 100`}/>
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" stroke="#4db6ac" strokeWidth="4"
              strokeDasharray={`${COMPANY_RATIO * 100} 100`} strokeDashoffset={`-${MEMBER_RATIO * 100}`}/>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>Total</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{fmt(totalSales)}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { color: '#a78bfa', label: '레퍼럴 수당 (P/F)', value: fmt(memSales), pct: '80%' },
          { color: '#4db6ac', label: '회사 매출',         value: fmt(compSales), pct: '20%' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }}/>
              <span style={{ fontFamily: 'var(--font-main)', color: 'var(--text-secondary)' }}>{item.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: item.color, fontWeight: 700 }}>{item.pct}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 직급별 분포 ───────────────────────────────────────────────────────────────
function RankChart({ profiles }: { profiles: Profile[] }) {
  const data = RANK_ORDER.map(rank => {
    const g = profiles.filter(p => p.rank === rank)
    return { rank, count: g.length, sales: g.reduce((s,p) => s + p.sales, 0), color: RANK_COLOR[rank] }
  }).filter(d => d.count > 0)
  const maxSales = Math.max(...data.map(d => d.sales), 1)

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20 }}>
      <div style={{ fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>직급별 매출 분포</div>
      {data.length === 0
        ? <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', padding: '16px 0' }}>데이터 없음</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.map(d => {
              const pct = (d.sales / maxSales) * 100
              return (
                <div key={d.rank} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: d.color, background: d.color + '18', border: `1px solid ${d.color}44`, padding: '2px 7px', borderRadius: 4, width: 38, textAlign: 'center', flexShrink: 0 }}>{d.rank}</span>
                  <div style={{ flex: 1, height: 20, background: 'var(--bg-inset)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${d.color}55,${d.color}cc)`, borderRadius: 4, minWidth: pct > 0 ? 4 : 0, transition: 'width 0.5s ease' }}/>
                  </div>
                  <div style={{ minWidth: 72, textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(d.sales)}</div>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)' }}>{d.count}개 노드</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ── 상위 노드 테이블 ──────────────────────────────────────────────────────────
function TopTable({ profiles }: { profiles: Profile[] }) {
  const totalSales = profiles.reduce((s,p) => s + p.sales, 0)
  const top = [...profiles].sort((a,b) => b.sales - a.sales).slice(0, 8)
  const isMobile = useIsMobile()

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>상위 매출 노드 현황</span>
        <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>매출 상위 8개 노드</span>
      </div>

      {/* 모바일 카드 */}
      {isMobile && (
        <div>
          {top.map((p, i) => {
            const rc = RANK_COLOR[p.rank]
            const pct = totalSales > 0 ? (p.sales / totalSales * 100) : 0
            const legC = p.leg_position === 'LEFT' ? '#3b82f6' : '#a78bfa'
            return (
              <div key={p.id} style={{ padding: '13px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', flexShrink: 0 }}>#{i+1}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-blue)' }}>{p.node_id}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: legC, background: legC + '18', border: `1px solid ${legC}44`, padding: '2px 6px', borderRadius: 4 }}>{p.leg_position ?? '—'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: rc, background: rc + '18', border: `1px solid ${rc}44`, padding: '2px 6px', borderRadius: 4 }}>{p.rank}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 5, background: 'var(--border-primary)', borderRadius: 3 }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: '#4db6ac', borderRadius: 3 }}/>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{pct.toFixed(1)}%</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{fmt(p.sales)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isMobile &&
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ background: 'rgba(10,12,16,0.5)' }}>
              {['순위','노드 ID','이름','레그','총 매출','전체 비중','직급'].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: h === '총 매출' || h === '전체 비중' ? 'right' : 'left', fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-primary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {top.map((p, i) => {
              const rc   = RANK_COLOR[p.rank]
              const pct  = totalSales > 0 ? (p.sales / totalSales * 100) : 0
              const legC = p.leg_position === 'LEFT' ? '#3b82f6' : '#a78bfa'
              return (
                <tr key={p.id} style={{ borderBottom: i < top.length - 1 ? '1px solid rgba(36,42,53,0.5)' : 'none', transition: 'background 0.15s', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                  <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>#{i+1}</td>
                  <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)' }}>{p.node_id}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', flexShrink: 0 }}>{p.name.slice(0,2).toUpperCase()}</div>
                      <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 4, border: `1px solid ${legC}44`, background: legC + '18', color: legC }}>{p.leg_position ?? '—'}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>{fmt(p.sales)}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <div style={{ width: 60, height: 4, background: 'var(--border-primary)', borderRadius: 2 }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: '#4db6ac', borderRadius: 2 }}/>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: rc, background: rc + '18', border: `1px solid ${rc}44`, padding: '2px 7px', borderRadius: 4 }}>{p.rank}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>}
    </div>
  )
}

// ── 페이지 ───────────────────────────────────────────────────────────────────
export default function SalesPage() {
  const [profiles,   setProfiles]   = useState<Profile[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [monthlyData, setMonthlyData] = useState<MonthPoint[]>([])
  const [legMonths,   setLegMonths]   = useState<LegMonth[]>([])
  const isMobile = useIsMobile()

  useEffect(() => {
    const run = async () => {
      try {
        // 1. 전체 프로필
        const profs = await adminGetAllProfiles()
        setProfiles(profs)

        // 2. profit_reports → 월별 매출 포인트
        const { data: reports } = await supabase
          .from('profit_reports')
          .select('id, date_from, date_to, total_unpaid, uploaded_at')
          .order('uploaded_at', { ascending: true })

        if (reports && reports.length > 0) {
          // 레포트별 label: "YY.MM" (date_from 기준)
          const pts: MonthPoint[] = (reports as ProfitReport[]).map(r => ({
            label: r.date_from.slice(2, 7).replace('-', '.'),
            value: r.total_unpaid,
          }))
          setMonthlyData(pts)

          // 3. profit_report_items → 레그별 월별 집계
          //    matched_node_id 는 node_id 문자열(RCT-xxxxx), 노드 uuid 는 matched_profile_id.
          //    leg 매칭은 uuid(profile.id) 기준이므로 matched_profile_id 를 사용한다.
          const { data: items } = await supabase
            .from('profit_report_items')
            .select('report_id, distributable_income, matched_profile_id')

          if (items && items.length > 0) {
            const nodeMap = new Map(profs.map(p => [p.id, p.leg_position]))
            const repMap  = new Map((reports as ProfitReport[]).map((r, i) => [r.id, pts[i].label]))

            const byReport: Record<string, { left: number; right: number }> = {}
            for (const it of items as ProfitReportItem[]) {
              if (!it.matched_profile_id) continue
              const leg = nodeMap.get(it.matched_profile_id)
              const label = repMap.get(it.report_id)
              if (!label) continue
              if (!byReport[label]) byReport[label] = { left: 0, right: 0 }
              if (leg === 'LEFT')  byReport[label].left  += it.distributable_income
              if (leg === 'RIGHT') byReport[label].right += it.distributable_income
            }

            const lm: LegMonth[] = Object.entries(byReport).map(([label, v]) => ({
              label, left: v.left, right: v.right,
            }))
            setLegMonths(lm)
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : (e as any)?.message ?? '오류')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const totalSales   = profiles.reduce((s,p) => s + p.sales, 0)
  const companySales = totalSales * COMPANY_RATIO
  const memberSales  = totalSales * MEMBER_RATIO
  const activeNodes  = profiles.filter(p => p.sales > 0).length
  const avgSales     = activeNodes > 0 ? totalSales / activeNodes : 0

  return (
    <div style={{ padding: isMobile ? 16 : 28, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <style>{`@keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* 헤더 */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>매출 현황</h1>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
          {loading ? '로딩 중...' : `전체 ${profiles.length}개 노드 · 매출 발생 ${activeNodes}개 · P/F 구조 회사 20% / 레퍼럴 수당 80%`}
        </p>
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>⚠ {error}</div>}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KpiCard loading={loading} label="총 매출" value={fmt(totalSales)} sub={`▲ ${activeNodes}개 노드 합산`} accent="#4db6ac"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}/>
        <KpiCard loading={loading} label="회사 매출 (20%)" value={fmt(companySales)} sub="운영비 · 마케팅 · 개발" accent="#4db6ac"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>}/>
        <KpiCard loading={loading} label="레퍼럴 수당 P/F (80%)" value={fmt(memberSales)} sub="노드 비례 지급" subColor="#a78bfa" accent="#a78bfa"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}/>
        <KpiCard loading={loading} label="평균 매출 / 노드" value={fmt(avgSales)} sub={`활성 ${activeNodes}개 노드 기준`} subColor="var(--text-tertiary)" accent="#64748b"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>}/>
      </div>

      {/* 월별 추이 + 도넛 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {loading
          ? <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, height: 320 }}/>
          : <MonthlyChart data={monthlyData}/>
        }
        {loading
          ? <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, height: 320 }}/>
          : <PieCard compSales={companySales} memSales={memberSales} totalSales={totalSales}/>
        }
      </div>

      {/* 레그별 + 직급별 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {loading
          ? <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, height: 240 }}/>
          : <LegBarChart profiles={profiles} legMonths={legMonths}/>
        }
        {loading
          ? <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, height: 240 }}/>
          : <RankChart profiles={profiles}/>
        }
      </div>

      {/* 상위 노드 */}
      {loading
        ? <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, height: 200 }}/>
        : <TopTable profiles={profiles}/>
      }
    </div>
  )
}
