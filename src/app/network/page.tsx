'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import TopNav from '@/components/TopNav'
import Sidebar from '@/components/Sidebar'
import SidebarHeader from '@/components/SidebarHeader'

const KPI = [
  { label: '글로벌 네트워크 PV', value: '14.8M', delta: '+11.2%', color: '#4db6ac' },
  { label: '전체 노드 수', value: '47,291', delta: '+2,341', color: '#60a5fa' },
  { label: '월간 Profit Share', value: '₩2.4B', delta: '+9.8%', color: '#c084fc' },
  { label: '평균 사이클 효율', value: '91.7%', delta: '-0.4%', color: '#f59e0b' },
]

const NAV = [
  { label: 'Global Overview', href: '/network', active: true },
  { label: 'Visual Designer', href: '/dashboard' },
  { label: 'Node Performance', href: '/dashboard/analytics' },
  { label: 'Rank Management', href: '/dashboard' },
  { label: 'Security Protocols', href: '/dashboard' },
]

const ALERTS = [
  { level: 'WARN', msg: '우측 레그 볼륨 불균형 감지 (L:62% / R:38%)', time: '2m ago' },
  { level: 'INFO', msg: 'PLATINUM III 등급 12명 승급 처리 완료', time: '8m ago' },
  { level: 'WARN', msg: '노드 N-2841 비활성화 상태 72시간 초과', time: '15m ago' },
  { level: 'OK', msg: '월간 Profit Sharing 정산 완료 — 98.2% 지급률', time: '1h ago' },
]

const ALERT_COLORS: Record<string, string> = {
  WARN: '#f59e0b',
  INFO: '#60a5fa',
  OK: '#4db6ac',
}

const RANKS = [
  { name: 'SILVER I', pct: 38, color: '#94a3b8', count: '17,980' },
  { name: 'GOLD II', pct: 28, color: '#f59e0b', count: '13,241' },
  { name: 'PLATINUM III', pct: 18, color: '#4db6ac', count: '8,512' },
  { name: 'DIAMOND', pct: 10, color: '#60a5fa', count: '4,729' },
  { name: 'CROWN', pct: 4, color: '#c084fc', count: '1,892' },
  { name: 'LEGACY', pct: 2, color: '#f97316', count: '937' },
]

function VolumeHistoryChart() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    c.width = c.offsetWidth; c.height = c.offsetHeight
    const w = c.width; const h = c.height
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const values = [8.2, 9.1, 8.8, 10.2, 11.5, 10.8, 12.3, 11.9, 13.1, 12.8, 14.2, 14.8]
    const maxV = Math.max(...values)
    const padL = 35; const padB = 24; const padT = 10; const padR = 10
    const uw = (w - padL - padR) / (values.length - 1)
    const uh = (h - padT - padB)

    const xs = values.map((_, i) => padL + i * uw)
    const ys = values.map(v => padT + uh - (v / maxV) * uh)

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padT + (uh / 4) * i
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y)
      ctx.strokeStyle = 'rgba(36,42,53,0.6)'; ctx.lineWidth = 0.5; ctx.stroke()
      const val = ((maxV * (1 - i / 4))).toFixed(0)
      ctx.font = '8px JetBrains Mono, monospace'; ctx.fillStyle = '#64748b'
      ctx.textAlign = 'right'; ctx.fillText(val + 'M', padL - 3, y + 3)
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB)
    grad.addColorStop(0, 'rgba(77,182,172,0.25)'); grad.addColorStop(1, 'rgba(77,182,172,0)')
    ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
    xs.forEach((x, i) => { if (i > 0) { const cp = (xs[i - 1] + x) / 2; ctx.bezierCurveTo(cp, ys[i - 1], cp, ys[i], x, ys[i]) } })
    ctx.lineTo(xs[xs.length - 1], h - padB); ctx.lineTo(xs[0], h - padB); ctx.closePath()
    ctx.fillStyle = grad; ctx.fill()

    // Line
    ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
    xs.forEach((x, i) => { if (i > 0) { const cp = (xs[i - 1] + x) / 2; ctx.bezierCurveTo(cp, ys[i - 1], cp, ys[i], x, ys[i]) } })
    ctx.strokeStyle = '#4db6ac'; ctx.lineWidth = 2; ctx.stroke()

    // Month labels
    months.forEach((m, i) => {
      ctx.font = '8px JetBrains Mono, monospace'; ctx.fillStyle = '#64748b'
      ctx.textAlign = 'center'; ctx.fillText(m, xs[i], h - 6)
    })
  }, [])
  return <canvas ref={ref} className="w-full h-full" />
}

export default function NetworkPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <TopNav breadcrumb="Global Network Analytics" statusLabel="SYSTEM_STABLE_V4" statusColor="#4db6ac" showPulseDot />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar width={200}>
          <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-primary)' }}>
            Command Center
          </div>
          <nav className="py-2">
            {NAV.map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2 px-4 py-2 font-mono text-[11px] transition-colors hover:bg-white/5"
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
        </Sidebar>

        {/* Main */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="font-main text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              글로벌 네트워크 분석
            </h1>
            <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              GLOBAL_NETWORK // REAL_TIME_ANALYTICS // {new Date().toLocaleDateString('ko-KR')}
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {KPI.map(k => (
              <div key={k.label} className="glass rounded-lg p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  {k.label}
                </div>
                <div className="font-mono text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
                <div className="font-mono text-[10px] mt-1" style={{ color: k.delta.startsWith('-') ? '#f87171' : '#4db6ac' }}>
                  {k.delta} vs prev
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Volume History */}
            <div className="glass rounded-lg p-4" style={{ height: 220 }}>
              <div className="font-mono text-[11px] tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
                Volume Expansion History (M PV)
              </div>
              <div style={{ height: 160 }}>
                <VolumeHistoryChart />
              </div>
            </div>

            {/* Rank Distribution */}
            <div className="glass rounded-lg p-4" style={{ height: 220 }}>
              <div className="font-mono text-[11px] tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
                Rank Distribution
              </div>
              <div className="space-y-2 mt-1">
                {RANKS.map(r => (
                  <div key={r.name} className="flex items-center gap-2">
                    <span className="font-mono text-[10px] w-24 shrink-0" style={{ color: r.color }}>{r.name}</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--bg-inset)' }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                    </div>
                    <span className="font-mono text-[10px] w-12 text-right" style={{ color: 'var(--text-tertiary)' }}>
                      {r.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Critical Alerts */}
          <div>
            <div className="font-mono text-[11px] tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
              Critical Network Alerts
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ALERTS.map((a, i) => (
                <div
                  key={i}
                  className="glass rounded-lg p-3 flex items-start gap-3"
                >
                  <span
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                    style={{ color: ALERT_COLORS[a.level], background: `${ALERT_COLORS[a.level]}18`, border: `1px solid ${ALERT_COLORS[a.level]}40` }}
                  >
                    {a.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>{a.msg}</div>
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
