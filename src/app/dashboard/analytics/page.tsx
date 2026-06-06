'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import TopNav from '@/components/TopNav'
import Sidebar from '@/components/Sidebar'
import SidebarHeader from '@/components/SidebarHeader'

const METRICS = [
  { label: 'Total Network PV', value: '1.42M', delta: '+8.2%', color: '#4db6ac' },
  { label: 'Active Nodes', value: '8,241', delta: '+124', color: '#60a5fa' },
  { label: 'Cycle Efficiency', value: '94.2%', delta: '+1.1%', color: '#4db6ac' },
  { label: 'Leg Drift', value: '4.1°', delta: '-0.3°', color: '#f59e0b' },
]

const NAV_ITEMS = [
  { label: 'Network Overview', href: '/dashboard' },
  { label: 'Performance Analytics', href: '/dashboard/analytics', active: true },
  { label: 'Rank Forecast', href: '/dashboard' },
  { label: 'Policy Manager', href: '/dashboard' },
]

function VolumeChart() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    c.width = c.offsetWidth; c.height = c.offsetHeight

    const w = c.width; const h = c.height
    const points = [20, 45, 35, 60, 50, 80, 70, 95, 85, 110, 100, 130]
    const maxP = Math.max(...points)
    const xs = points.map((_, i) => (i / (points.length - 1)) * w)
    const ys = points.map(p => h - (p / maxP) * (h - 20) - 10)

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, 'rgba(77,182,172,0.3)')
    grad.addColorStop(1, 'rgba(77,182,172,0)')
    ctx.beginPath()
    ctx.moveTo(xs[0], ys[0])
    for (let i = 1; i < xs.length; i++) {
      const cpx = (xs[i - 1] + xs[i]) / 2
      ctx.bezierCurveTo(cpx, ys[i - 1], cpx, ys[i], xs[i], ys[i])
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
    ctx.fillStyle = grad; ctx.fill()

    // Line
    ctx.beginPath()
    ctx.moveTo(xs[0], ys[0])
    for (let i = 1; i < xs.length; i++) {
      const cpx = (xs[i - 1] + xs[i]) / 2
      ctx.bezierCurveTo(cpx, ys[i - 1], cpx, ys[i], xs[i], ys[i])
    }
    ctx.strokeStyle = '#4db6ac'; ctx.lineWidth = 2; ctx.stroke()

    // Dots
    xs.forEach((x, i) => {
      ctx.beginPath(); ctx.arc(x, ys[i], 3, 0, Math.PI * 2)
      ctx.fillStyle = '#4db6ac'; ctx.fill()
    })
  }, [])
  return <canvas ref={ref} className="w-full h-full" />
}

function CompressionChart() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    c.width = c.offsetWidth; c.height = c.offsetHeight
    const w = c.width; const h = c.height
    const bars = [0.9, 0.75, 0.85, 0.6, 0.95, 0.7]
    const bw = w / bars.length - 6
    bars.forEach((v, i) => {
      const bh = v * (h - 20)
      const x = i * (bw + 6) + 3
      ctx.fillStyle = `rgba(77,182,172,${0.3 + v * 0.4})`
      ctx.fillRect(x, h - bh - 5, bw, bh)
    })
  }, [])
  return <canvas ref={ref} className="w-full h-full" />
}

function RetentionChart() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    c.width = c.offsetWidth; c.height = c.offsetHeight
    const w = c.width; const h = c.height
    const points = [88, 90, 85, 92, 89, 94, 91, 96]
    const xs = points.map((_, i) => (i / (points.length - 1)) * w)
    const ys = points.map(p => h - ((p - 80) / 20) * (h - 20) - 10)
    ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
    xs.forEach((x, i) => { if (i > 0) ctx.lineTo(x, ys[i]) })
    ctx.strokeStyle = '#9d50bb'; ctx.lineWidth = 2; ctx.stroke()
    xs.forEach((x, i) => {
      ctx.beginPath(); ctx.arc(x, ys[i], 3, 0, Math.PI * 2)
      ctx.fillStyle = '#9d50bb'; ctx.fill()
    })
  }, [])
  return <canvas ref={ref} className="w-full h-full" />
}

function LegBalanceBar() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let animId: number
    let t = 0
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight }
    resize()

    const draw = () => {
      const w = c.width; const h = c.height
      ctx.clearRect(0, 0, w, h)
      const leftPct = 0.62 + Math.sin(t * 0.02) * 0.03
      const rightPct = 1 - leftPct
      const bh = h * 0.6
      const barW = w / 2 - 16
      const y = (h - bh) / 2

      // Left bar
      ctx.fillStyle = 'rgba(36,42,53,0.8)'
      ctx.fillRect(8, y, barW, bh)
      ctx.fillStyle = '#4db6ac'
      ctx.fillRect(8, y, barW * leftPct, bh)

      // Right bar
      ctx.fillStyle = 'rgba(36,42,53,0.8)'
      ctx.fillRect(w / 2 + 8, y, barW, bh)
      ctx.fillStyle = '#9d50bb'
      ctx.fillRect(w / 2 + 8, y, barW * rightPct, bh)

      // Labels
      ctx.font = '9px JetBrains Mono, monospace'
      ctx.fillStyle = '#64748b'
      ctx.textAlign = 'center'
      ctx.fillText('LEFT', 8 + barW / 2, h - 6)
      ctx.fillText('RIGHT', w / 2 + 8 + barW / 2, h - 6)

      ctx.fillStyle = '#4db6ac'
      ctx.fillText(`${(leftPct * 100).toFixed(0)}%`, 8 + barW / 2, y - 4)
      ctx.fillStyle = '#9d50bb'
      ctx.fillText(`${(rightPct * 100).toFixed(0)}%`, w / 2 + 8 + barW / 2, y - 4)

      t++
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])
  return <canvas ref={ref} className="w-full h-full" />
}

function DecayGauge() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let animId: number; let t = 0
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    c.width = c.offsetWidth; c.height = c.offsetHeight

    const draw = () => {
      const w = c.width; const h = c.height
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2; const cy = h / 2; const r = Math.min(w, h) / 2 - 8

      // Track
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25)
      ctx.strokeStyle = 'rgba(36,42,53,0.8)'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke()

      // Value arc
      const pct = 0.94 + Math.sin(t * 0.015) * 0.02
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * pct)
      ctx.strokeStyle = '#4db6ac'; ctx.lineWidth = 8; ctx.stroke()

      // Text
      ctx.font = `bold 16px JetBrains Mono, monospace`
      ctx.fillStyle = '#e0e6ed'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`${(pct * 100).toFixed(0)}%`, cx, cy)
      ctx.font = '9px JetBrains Mono, monospace'
      ctx.fillStyle = '#64748b'
      ctx.fillText('EFFICIENCY', cx, cy + 18)

      t++; animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])
  return <canvas ref={ref} className="w-full h-full" />
}

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <TopNav breadcrumb="Performance Analytics" statusLabel="LIVE_NETWORK_O1" showPulseDot />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar>
          <SidebarHeader label="Network Hierarchy" />
          <nav className="py-2">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2 px-4 py-2 font-mono text-xs transition-colors hover:bg-white/5"
                style={{
                  color: item.active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  background: item.active ? 'rgba(77,182,172,0.06)' : undefined,
                  borderLeft: item.active ? '2px solid var(--accent-blue)' : '2px solid transparent',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <SidebarHeader label="System Logs" />
            <div className="px-4 py-3 space-y-1">
              {['[OK] Network sync', '[OK] Leg balance', '[WARN] Drift detected'].map(log => (
                <div key={log} className="font-mono text-[10px]" style={{ color: log.includes('WARN') ? '#f59e0b' : 'var(--text-tertiary)' }}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-3">
            {METRICS.map(m => (
              <div key={m.label} className="glass rounded-lg p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  {m.label}
                </div>
                <div className="font-mono text-2xl font-bold" style={{ color: m.color }}>
                  {m.value}
                </div>
                <div className="font-mono text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {m.delta} vs last cycle
                </div>
              </div>
            ))}
          </div>

          {/* Volume Timeline */}
          <div className="glass rounded-lg p-4" style={{ height: 180 }}>
            <div className="font-mono text-[11px] tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
              Volume Distribution Timeline
            </div>
            <div style={{ height: 130 }}>
              <VolumeChart />
            </div>
          </div>

          {/* Bottom charts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-lg p-4" style={{ height: 140 }}>
              <div className="font-mono text-[11px] tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
                Compression Curve
              </div>
              <div style={{ height: 90 }}>
                <CompressionChart />
              </div>
            </div>
            <div className="glass rounded-lg p-4" style={{ height: 140 }}>
              <div className="font-mono text-[11px] tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
                Retention Index
              </div>
              <div style={{ height: 90 }}>
                <RetentionChart />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div
          className="w-56 shrink-0 flex flex-col overflow-y-auto"
          style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-primary)' }}
        >
          <SidebarHeader label="Live Analytics" />
          <div className="p-3 space-y-4">
            {/* Leg Balance */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Leg Balance
              </div>
              <div style={{ height: 80 }}>
                <LegBalanceBar />
              </div>
            </div>

            {/* Decay Gauge */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Performance Decay
              </div>
              <div style={{ height: 90 }}>
                <DecayGauge />
              </div>
            </div>

            {/* Rank Progression */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Rank Progression
              </div>
              <div className="space-y-1.5">
                {[
                  { rank: 'SILVER I', pct: 100, color: '#94a3b8' },
                  { rank: 'GOLD II', pct: 100, color: '#f59e0b' },
                  { rank: 'PLATINUM III', pct: 78, color: '#4db6ac' },
                  { rank: 'DIAMOND', pct: 22, color: '#60a5fa' },
                ].map(r => (
                  <div key={r.rank}>
                    <div className="flex justify-between font-mono text-[9px] mb-0.5">
                      <span style={{ color: r.color }}>{r.rank}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{r.pct}%</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'var(--bg-inset)' }}>
                      <div className="h-1 rounded-full transition-all" style={{ width: `${r.pct}%`, background: r.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Assessment */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Risk Assessment
              </div>
              <div className="space-y-1">
                {[
                  { label: 'Leg Drift', risk: 'LOW', color: '#4db6ac' },
                  { label: 'Compression', risk: 'MED', color: '#f59e0b' },
                  { label: 'Decay Rate', risk: 'LOW', color: '#4db6ac' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between font-mono text-[10px]">
                    <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                    <span style={{ color: r.color }}>{r.risk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
