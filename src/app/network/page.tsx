'use client'
import Link from 'next/link'
import TopNav from '@/components/TopNav'

const KPI = [
  { label: 'Total Network Volume', value: '842,910 PV', trend: '12.4% vs last period', up: true },
  { label: 'Active Nodes', value: '12,482', trend: '342 new this week', up: true },
  { label: 'Growth Velocity', value: '1.84x', trend: '0.04% stabilization', up: false },
  { label: 'Network Depth', value: '142 Levels', trend: 'Expansion optimized', up: true },
]

const RANKS = [
  { name: 'Diamond+', pct: 15, count: '182명' },
  { name: 'Platinum', pct: 35, count: '412명' },
  { name: 'Gold', pct: 55, count: '924명' },
  { name: 'Silver', pct: 75, count: '1.2k명' },
  { name: 'Associate', pct: 90, count: '9.8k명' },
]

const ALERTS = [
  { color: '#ef4444', title: 'Left Leg Imbalance Detected', meta: '2 mins ago • Root Node #0012', action: 'Resolve' },
  { color: '#f59e0b', title: 'Rank Decay Warning: Alpha-9', meta: '14 mins ago • Region: EMEA', action: 'Notify' },
  { color: '#4db6ac', title: 'Node Compression Complete', meta: '1 hour ago • Optimization Engine', action: 'View Results' },
  { color: '#f59e0b', title: 'Unusual Growth Pattern', meta: '3 hours ago • Gamma-Leg', action: 'Analyze' },
]

const NAV = [
  { label: '글로벌 개요', href: '/network', active: true },
  { label: '비주얼 디자이너', href: '/dashboard' },
  { label: '노드 성과', href: '/dashboard/analytics' },
  { label: '직급 관리', href: '/dashboard' },
]

export default function NetworkPage() {
  return (
    <>
      <style>{`
        .sidebar-header {
          padding: 12px 16px;
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--text-tertiary);
          border-bottom: 1px solid var(--border-primary);
        }
        .nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          font-size: 13px;
          color: var(--text-secondary);
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s;
          border-left: 2px solid transparent;
        }
        .nav-item:hover { background: rgba(255,255,255,0.04); }
        .nav-item.active {
          background: var(--accent-blue-dim);
          color: var(--accent-blue);
          border-left-color: var(--accent-blue);
        }
        .kpi-card {
          background: rgba(23,26,33,0.8);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
          padding: 16px;
        }
        .chart-card {
          background: rgba(23,26,33,0.8);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }
        .alert-card {
          background: rgba(23,26,33,0.8);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .btn-ghost-sm {
          padding: 4px 10px;
          font-family: var(--font-mono);
          font-size: 11px;
          border-radius: 4px;
          border: 1px solid var(--border-secondary);
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .btn-ghost-sm:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
        <TopNav breadcrumb="Network Intelligence" statusLabel="SYSTEM_STABLE_V4" statusColor="accent" showAvatar />

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', flex: 1, overflow: 'hidden' }}>

          {/* Left Sidebar */}
          <aside style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="sidebar-header">Command Center</div>
            <nav style={{ flex: 1, overflowY: 'auto' }}>
              {NAV.map(item => (
                <Link key={item.label} href={item.href} className={`nav-item${item.active ? ' active' : ''}`}>
                  {item.active && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                  )}
                  {item.label}
                </Link>
              ))}
              <div style={{ borderTop: '1px solid var(--border-primary)', marginTop: 8 }}>
                <div className="sidebar-header" style={{ borderBottom: 'none' }}>Infrastructure</div>
                <Link href="/dashboard" className="nav-item">보안 프로토콜</Link>
              </div>
            </nav>
          </aside>

          {/* Main */}
          <main style={{ padding: 32, overflowY: 'auto', background: 'radial-gradient(ellipse at center, #1a1e26 0%, #0f1115 100%)' }}>
            {/* Page header */}
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>글로벌 네트워크 분석</h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>RCT 에코시스템 전반의 종합 성과 데이터입니다.</p>
            </div>

            {/* KPI grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              {KPI.map(k => (
                <div key={k.label} className="kpi-card">
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{k.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{k.value}</div>
                  <div style={{ fontSize: 12, color: k.up ? '#4db6ac' : '#f59e0b' }}>
                    {k.up ? '↑' : '↓'} {k.trend}
                  </div>
                </div>
              ))}
            </div>

            {/* Main grid: 2fr 1fr */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
              {/* Volume Expansion History */}
              <div className="chart-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>Volume Expansion History</span>
                  <button className="btn-ghost-sm">Export Data</button>
                </div>
                <div style={{ flex: 1, position: 'relative', minHeight: 160 }}>
                  <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4db6ac" stopOpacity="0.3"/>
                        <stop offset="100%" stopColor="#4db6ac" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d="M0 180 Q 150 140 300 160 T 600 80 T 900 100 L 900 240 L 0 240 Z" fill="url(#chartGradient)"/>
                    <path d="M0 180 Q 150 140 300 160 T 600 80 T 900 100" stroke="#4db6ac" strokeWidth="2" fill="none"/>
                    <circle cx="600" cy="80" r="4" fill="#0f1115" stroke="#4db6ac" strokeWidth="2"/>
                  </svg>
                </div>
              </div>

              {/* Rank Distribution */}
              <div className="chart-card">
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Rank Distribution</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {RANKS.map(r => (
                    <div key={r.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{r.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{r.count}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-inset)', borderRadius: 2 }}>
                        <div style={{ height: 4, width: `${r.pct}%`, background: 'var(--accent-blue)', borderRadius: 2, opacity: 0.7 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Critical Network Alerts - spans 2 cols conceptually (full width here) */}
            <div className="chart-card">
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Critical Network Alerts</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {ALERTS.map((a, i) => (
                  <div key={i} className="alert-card">
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: a.color, flexShrink: 0, marginTop: 4,
                      boxShadow: `0 0 6px ${a.color}80`,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{a.title}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{a.meta}</div>
                    </div>
                    <button className="btn-ghost-sm">{a.action}</button>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
