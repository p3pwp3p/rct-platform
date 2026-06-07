'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import TopNav from '@/components/TopNav'

interface TreeNode {
  x: number
  y: number
  vx: number
  vy: number
  level: number
  children: TreeNode[]
}

function buildTree(x: number, y: number, level: number, maxLevel: number, xOffset: number): TreeNode {
  const node: TreeNode = {
    x, y,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    level,
    children: [],
  }
  if (level < maxLevel) {
    node.children = [
      buildTree(x - xOffset, y + 80, level + 1, maxLevel, xOffset / 1.8),
      buildTree(x + xOffset, y + 80, level + 1, maxLevel, xOffset / 1.8),
    ]
  }
  return node
}

export default function DashboardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const treeRef = useRef<TreeNode | null>(null)
  const animRef = useRef<number>(0)
  const [legBalance, setLegBalance] = useState<'L-HEAVY' | 'R-AUTO'>('L-HEAVY')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const rootX = canvas.width * 0.65
      const rootY = canvas.height * 0.45
      treeRef.current = buildTree(rootX, rootY, 0, 4, 180)
    }
    resize()
    window.addEventListener('resize', resize)

    let t = 0
    const drawNode = (node: TreeNode) => {
      const nx = node.x + Math.sin(t * 0.02 + node.level) * 3
      const ny = node.y + Math.cos(t * 0.015 + node.level) * 3

      // Draw connections to children
      for (const child of node.children) {
        const cx = child.x + Math.sin(t * 0.02 + child.level) * 3
        const cy = child.y + Math.cos(t * 0.015 + child.level) * 3
        ctx.beginPath()
        ctx.moveTo(nx, ny)
        ctx.lineTo(cx, cy)
        ctx.strokeStyle = 'rgba(77,182,172,0.1)'
        ctx.lineWidth = 1
        ctx.stroke()
        drawNode(child)
      }

      // Halo pulse
      const pulse = (Math.sin(t * 0.05 + node.level * 1.5) + 1) / 2
      const haloR = 6 + pulse * 4
      const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, haloR)
      grad.addColorStop(0, 'rgba(77,182,172,0.3)')
      grad.addColorStop(1, 'rgba(77,182,172,0)')
      ctx.beginPath()
      ctx.arc(nx, ny, haloR, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // Node dot
      ctx.beginPath()
      ctx.arc(nx, ny, node.level === 0 ? 5 : 3, 0, Math.PI * 2)
      ctx.fillStyle = node.level === 0 ? '#4db6ac' : `rgba(77,182,172,${0.8 - node.level * 0.15})`
      ctx.fill()
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (treeRef.current) drawNode(treeRef.current)
      t++
      animRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        .floating-card {
          background: rgba(23,26,33,0.85);
          border: 1px solid var(--border-secondary);
          border-radius: 8px;
          padding: 14px;
          backdrop-filter: blur(12px);
          animation: float 6s ease-in-out infinite;
          position: absolute;
        }
        .node-item {
          display: flex;
          align-items: center;
          padding: 7px 16px;
          font-family: var(--font-main);
          font-size: 12px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.15s;
        }
        .node-item:hover { background: rgba(255,255,255,0.04); }
        .node-item.active {
          background: var(--accent-blue-dim);
          color: var(--accent-blue);
        }
        .tool-btn {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
          color: var(--text-tertiary);
          border: none;
          background: none;
        }
        .tool-btn:hover { background: rgba(255,255,255,0.06); }
        .tool-btn.active { background: var(--accent-blue-dim); color: var(--accent-blue); }
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--text-tertiary);
          border-bottom: 1px solid var(--border-primary);
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
        <TopNav breadcrumb="Main Network" statusLabel="LIVE_NETWORK_O1" statusColor="accent" showPulseDot showAvatar />

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', flex: 1, overflow: 'hidden' }}>

          {/* Left Sidebar */}
          <aside style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="sidebar-header">
              <span>Network Layers</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div className="node-item active">Global Root</div>
              <div className="node-item" style={{ paddingLeft: 40 }}>Left Leg (Primary)</div>
              <div className="node-item" style={{ paddingLeft: 52, opacity: 0.6 }}>Alpha Group</div>
              <div className="node-item" style={{ paddingLeft: 52, opacity: 0.6 }}>Beta Group</div>
              <div className="node-item" style={{ paddingLeft: 40 }}>Right Leg (Secondary)</div>
              <div className="node-item" style={{ paddingLeft: 52, opacity: 0.6 }}>Gamma Branch</div>
              <div className="node-item" style={{ paddingLeft: 64, opacity: 0.4 }}>Active Nodes (42)</div>
            </div>
            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-primary)' }}>
              <div className="sidebar-header">Assets</div>
              <div style={{ padding: '8px 0' }}>
                <div className="node-item" style={{ gap: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  Network_Map_v2
                </div>
                <div className="node-item" style={{ gap: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  export_stats.csv
                </div>
              </div>
            </div>
          </aside>

          {/* Center Canvas */}
          <section style={{ position: 'relative', background: 'radial-gradient(ellipse at 65% 45%, #1a1e26 0%, #0f1115 100%)', overflow: 'hidden' }}>
            {/* Grid lines */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: 'linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }} />

            {/* Network canvas */}
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

            {/* Overlay text */}
            <div style={{ position: 'absolute', top: 40, left: 40, maxWidth: 480, pointerEvents: 'none' }}>
              <h1 style={{
                fontSize: 42, fontWeight: 700, lineHeight: 1.2, marginBottom: 16,
                fontFamily: 'var(--font-main)',
                background: 'linear-gradient(180deg, #f8fafc 0%, #94a3b8 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                당신의 네트워크 운명을 설계하세요
              </h1>
              <p style={{ fontFamily: 'var(--font-main)', fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                복잡한 바이너리 레그 구조를 정밀하게 시각화합니다. 실시간 데이터 기반 계층 관리로 성장을 최적화하세요.
              </p>
              <div style={{ display: 'flex', gap: 12, pointerEvents: 'all' }}>
                <Link href="/signup" style={{
                  padding: '12px 24px', background: 'var(--accent-blue)', color: '#0f1115',
                  fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, borderRadius: 4,
                  textDecoration: 'none', letterSpacing: '0.01em',
                }}>
                  노드 초기화
                </Link>
                <Link href="/init" style={{
                  padding: '12px 24px', border: '1px solid var(--border-secondary)', color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-main)', fontSize: 13, borderRadius: 4,
                  textDecoration: 'none', letterSpacing: '0.01em', background: 'rgba(23,26,33,0.7)',
                }}>
                  블루프린트 보기
                </Link>
              </div>
            </div>

            {/* Floating card: Current Rank */}
            <div className="floating-card" style={{ top: '15%', right: '10%', animationDelay: '-1s', minWidth: 160 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>Current Rank</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 8 }}>Platinum II</div>
              <div style={{ height: 3, background: 'var(--border-primary)', borderRadius: 2, marginBottom: 6 }}>
                <div style={{ height: 3, width: '72%', background: 'var(--accent-blue)', borderRadius: 2 }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>Next: Diamond</div>
            </div>

            {/* Floating card: Total Volume */}
            <div className="floating-card" style={{ bottom: '15%', right: '25%', animationDelay: '-3.5s', minWidth: 160 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>Total Volume</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>142.8k PV</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 32 }}>
                {[20, 25, 18, 32].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: h, background: 'var(--accent-blue)', opacity: 0.4 + i * 0.15, borderRadius: 2 }} />
                ))}
              </div>
            </div>

            {/* Bottom toolbar */}
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(23,26,33,0.9)', border: '1px solid var(--border-primary)',
              borderRadius: 12, padding: '6px 10px', backdropFilter: 'blur(12px)',
            }}>
              <Link href="/dashboard">
                <button className="tool-btn active" title="Dashboard">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </button>
              </Link>
              <Link href="/network">
                <button className="tool-btn" title="Network">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                </button>
              </Link>
              <button className="tool-btn" title="Add">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              </button>
              <div style={{ width: 1, height: 20, background: 'var(--border-primary)', margin: '0 4px' }} />
              <button className="tool-btn" title="Expand">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              </button>
            </div>
          </section>

          {/* Right Sidebar */}
          <aside style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="sidebar-header">
              <span>System Properties</span>
              <span style={{ color: 'var(--accent-blue)', fontSize: 10 }}>AUTO</span>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', flex: 1 }}>
              {/* Hierarchy Engine */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Hierarchy Engine
                </label>
                <select style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 4, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none' }}>
                  <option>Binary Dynamic Rank</option>
                  <option>Unilevel Compression</option>
                </select>
              </div>

              {/* Performance Decay */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>Performance Decay</label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>0.12%</span>
                </div>
                <input type="range" min={0} max={100} defaultValue={12} style={{ width: '100%', accentColor: '#4db6ac' }} />
              </div>

              {/* Active Leg Balancing */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Active Leg Balancing
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['L-HEAVY', 'R-AUTO'] as const).map(v => (
                    <button key={v} onClick={() => setLegBalance(v)} style={{
                      flex: 1, padding: '7px 4px',
                      fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', borderRadius: 4,
                      border: `1px solid ${legBalance === v ? 'var(--accent-blue)' : 'var(--border-secondary)'}`,
                      background: legBalance === v ? 'var(--accent-blue-dim)' : 'var(--bg-inset)',
                      color: legBalance === v ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                    }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Binary Visualizer */}
            <div style={{ borderTop: '1px solid var(--border-primary)' }}>
              <div className="sidebar-header">Binary Visualizer</div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[{ label: 'Depth', val: '128' }, { label: 'Spacing', val: '1.2' }].map(f => (
                    <div key={f.label}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>{f.label}</div>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                        background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)',
                        borderRadius: 4, padding: '6px 10px', textAlign: 'center',
                      }}>
                        {f.val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
