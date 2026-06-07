'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'

function VolumeChart() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    c.width = c.offsetWidth; c.height = c.offsetHeight
    const w = c.width, h = c.height
    const pts = [20, 45, 35, 60, 50, 80, 70, 95, 85, 110, 100, 130]
    const maxP = Math.max(...pts)
    const xs = pts.map((_, i) => (i / (pts.length - 1)) * w)
    const ys = pts.map(p => h - (p / maxP) * (h - 20) - 10)
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, 'rgba(77,182,172,0.3)'); grad.addColorStop(1, 'rgba(77,182,172,0)')
    ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
    for (let i = 1; i < xs.length; i++) {
      const cp = (xs[i-1]+xs[i])/2
      ctx.bezierCurveTo(cp, ys[i-1], cp, ys[i], xs[i], ys[i])
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
    ctx.fillStyle = grad; ctx.fill()
    ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
    for (let i = 1; i < xs.length; i++) {
      const cp = (xs[i-1]+xs[i])/2
      ctx.bezierCurveTo(cp, ys[i-1], cp, ys[i], xs[i], ys[i])
    }
    ctx.strokeStyle = '#4db6ac'; ctx.lineWidth = 2; ctx.stroke()
    xs.forEach((x, i) => {
      ctx.beginPath(); ctx.arc(x, ys[i], 3, 0, Math.PI*2)
      ctx.fillStyle = '#4db6ac'; ctx.fill()
    })
  }, [])
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

function CompressionChart() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    c.width = c.offsetWidth; c.height = c.offsetHeight
    const w = c.width, h = c.height
    const bars = [0.9, 0.75, 0.85, 0.6, 0.95, 0.7]
    const bw = w / bars.length - 6
    bars.forEach((v, i) => {
      const bh = v * (h - 20)
      ctx.fillStyle = `rgba(77,182,172,${0.3 + v * 0.4})`
      ctx.fillRect(i * (bw + 6) + 3, h - bh - 5, bw, bh)
    })
  }, [])
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

function RetentionChart() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    c.width = c.offsetWidth; c.height = c.offsetHeight
    const w = c.width, h = c.height
    const pts = [88, 90, 85, 92, 89, 94, 91, 96]
    const xs = pts.map((_, i) => (i / (pts.length - 1)) * w)
    const ys = pts.map(p => h - ((p - 80) / 20) * (h - 20) - 10)
    ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
    xs.forEach((x, i) => { if (i > 0) ctx.lineTo(x, ys[i]) })
    ctx.strokeStyle = '#9d50bb'; ctx.lineWidth = 2; ctx.stroke()
    xs.forEach((x, i) => {
      ctx.beginPath(); ctx.arc(x, ys[i], 3, 0, Math.PI*2)
      ctx.fillStyle = '#9d50bb'; ctx.fill()
    })
  }, [])
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

function LegBalanceViz() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    let animId: number
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight }
    resize()
    const draw = () => {
      const w = c.width, h = c.height
      ctx.clearRect(0, 0, w, h)
      const leftPct = 0.62 + Math.sin(Date.now() / 2000) * 0.03
      ctx.fillStyle = 'rgba(36,42,53,0.5)'; ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#4db6ac'; ctx.fillRect(0, 0, w * leftPct, h)
      ctx.fillStyle = '#9d50bb'; ctx.fillRect(w * leftPct, 0, w * (1 - leftPct), h)
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])
  return <canvas ref={ref} style={{ width: '100%', height: 40, borderRadius: 4 }} />
}

function DecayGauge() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    let animId: number
    c.width = 120; c.height = 120
    const draw = () => {
      ctx.clearRect(0, 0, 120, 120)
      const cx = 60, cy = 60, r = 40
      const pct = 0.24 + Math.sin(Date.now() / 1500) * 0.02
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(36,42,53,0.8)'; ctx.lineWidth = 8; ctx.stroke()
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct)
      ctx.strokeStyle = '#4db6ac'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke()
      ctx.font = 'bold 16px JetBrains Mono, monospace'
      ctx.fillStyle = '#e0e6ed'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`${Math.round(pct * 100)}%`, cx, cy)
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])
  return <canvas ref={ref} style={{ width: 120, height: 120 }} />
}

const STATS = [
  { label: 'TOTAL NETWORK PV', value: '1.42M', trend: '+12.4%', up: true },
  { label: 'ACTIVE NODES', value: '8,241', trend: '+2.1%', up: true },
  { label: 'CYCLE EFFICIENCY', value: '94.2%', trend: '+0.8%', up: true },
  { label: 'LEG DRIFT', value: '4.1°', trend: '-1.2%', up: false },
]

const SECONDARY_NAV = [
  { label: '네트워크 개요', href: '/dashboard', icon: 'home' },
  { label: '성과 분석', href: '/dashboard/analytics', active: true, icon: 'chart' },
  { label: '직급 예측', href: '/dashboard', icon: 'clock' },
  { label: '정책 관리', href: '/dashboard', icon: 'shield' },
]

const TIMELINE = [
  { date: 'OCT 12, 2023', desc: 'Attained Platinum II (+42% MoM)', est: false },
  { date: 'NOV 05, 2023', desc: 'Volume Milestone: 1.2M PV', est: false },
  { date: 'EST. DEC 01', desc: 'Forecasted: Platinum III Achievement', est: true },
]

function SecondaryIcon({ name }: { name: string }) {
  const attrs = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'home': return <svg {...attrs}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    case 'chart': return <svg {...attrs}><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
    case 'clock': return <svg {...attrs}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    case 'shield': return <svg {...attrs}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    default: return null
  }
}

export default function AnalyticsPage() {
  return (
    <>
      <style>{`
        .analytics-menu-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 16px;
          font-family: var(--font-main); font-size: 13px;
          color: var(--text-secondary);
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s;
        }
        .analytics-menu-item:hover { background: rgba(255,255,255,0.04); }
        .analytics-menu-item.active {
          background: rgba(77,182,172,0.06);
          color: var(--accent-blue);
          border-right: 2px solid var(--accent-blue);
        }
        .stat-card {
          background: rgba(23,26,33,0.8);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
          padding: 16px;
        }
        .chart-card {
          background: rgba(23,26,33,0.8);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
        }
        .analytics-sidebar-header {
          padding: 12px 16px;
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--text-tertiary);
          border-bottom: 1px solid var(--border-primary);
        }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 320px', height: '100%', overflow: 'hidden' }}>

        {/* Secondary Left Panel */}
        <aside style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="analytics-sidebar-header">Network Hierarchy</div>
          <nav style={{ flex: 1, overflowY: 'auto' }}>
            {SECONDARY_NAV.map(item => (
              <Link key={item.label} href={item.href} className={`analytics-menu-item${item.active ? ' active' : ''}`}>
                <SecondaryIcon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-primary)' }}>
            <div className="analytics-sidebar-header">System Logs</div>
            <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { text: '[14:22:01] Re-balancing L-Leg...', color: 'var(--text-tertiary)' },
                { text: '[14:21:48] PV Update +1.2k', color: 'var(--text-tertiary)' },
                { text: '[14:20:12] Node #841 Verified', color: 'var(--accent-blue)' },
              ].map(log => (
                <div key={log.text} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: log.color }}>
                  {log.text}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ padding: 24, overflowY: 'auto', background: 'radial-gradient(ellipse at center, #1a1e26 0%, #0f1115 100%)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {STATS.map(s => (
              <div key={s.label} className="stat-card">
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: s.up ? '#4db6ac' : '#f87171' }}>
                  {s.up ? '▲' : '▼'} {s.trend}
                </div>
              </div>
            ))}
          </div>

          <div className="chart-card" style={{ height: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Volume Distribution Timeline</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['7D', '24H'].map(b => (
                  <span key={b} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', color: 'var(--text-tertiary)' }}>{b}</span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <VolumeChart />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="chart-card" style={{ height: 160 }}>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Compression Curve</div>
              <div style={{ flex: 1 }}><CompressionChart /></div>
            </div>
            <div className="chart-card" style={{ height: 160 }}>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Retention Index</div>
              <div style={{ flex: 1 }}><RetentionChart /></div>
            </div>
          </div>
        </main>

        {/* Right Panel */}
        <aside style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-primary)', padding: 20, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>LEG BALANCE (LIVE)</div>
            <LegBalanceViz />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)' }}>842.1k PV</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-purple)' }}>518.3k PV</span>
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>PERFORMANCE DECAY</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DecayGauge />
            </div>
            <p style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 8 }}>
              Projected loss within next 48h based on inactivity clusters.
            </p>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>RANK PROGRESSION TIMELINE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TIMELINE.map(item => (
                <div key={item.date} style={{
                  paddingLeft: 12,
                  borderLeft: `2px solid ${item.est ? 'var(--accent-blue)' : 'var(--border-secondary)'}`,
                  borderLeftStyle: item.est ? 'dashed' : 'solid',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: item.est ? 'var(--accent-blue)' : 'var(--text-tertiary)', marginBottom: 2 }}>{item.date}</div>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto', background: 'var(--bg-inset)', borderRadius: 6, padding: 12 }}>
            <div style={{ height: 4, background: 'var(--border-primary)', borderRadius: 2, marginBottom: 8 }}>
              <div style={{ height: 4, width: '15%', background: '#4db6ac', borderRadius: 2 }} />
            </div>
            <p style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>Network health remains optimal.</p>
          </div>
        </aside>
      </div>
    </>
  )
}
