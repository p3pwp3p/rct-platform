'use client'
import { useEffect, useRef } from 'react'
import TopNav from '@/components/TopNav'

interface TreeNode {
  x: number; y: number; level: number; children: TreeNode[]
}

function buildTree(x: number, y: number, level: number, maxLevel: number, spread: number): TreeNode {
  const node: TreeNode = { x, y, level, children: [] }
  if (level < maxLevel) {
    node.children = [
      buildTree(x - spread, y + 70, level + 1, maxLevel, spread / 1.8),
      buildTree(x + spread, y + 70, level + 1, maxLevel, spread / 1.8),
    ]
  }
  return node
}

function GhostCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    let animId: number
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight }
    resize()
    const root = buildTree(c.width * 0.5, c.height * 0.15, 0, 4, 140)
    let t = 0
    const drawNode = (node: TreeNode) => {
      const nx = node.x + Math.sin(t * 0.015 + node.level) * 2
      const ny = node.y + Math.cos(t * 0.012 + node.level) * 2
      for (const child of node.children) {
        const cx = child.x + Math.sin(t * 0.015 + child.level) * 2
        const cy = child.y + Math.cos(t * 0.012 + child.level) * 2
        const pulse = (Math.sin(t * 0.04 + node.level) + 1) / 2
        ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(cx, cy)
        ctx.strokeStyle = `rgba(77,182,172,${0.03 + pulse * 0.05})`
        ctx.lineWidth = 1; ctx.stroke()
        drawNode(child)
      }
      ctx.beginPath(); ctx.arc(nx, ny, 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(77,182,172,0.15)`; ctx.fill()
    }
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      drawNode(root)
      t++; animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
}

export default function DashboardLoading() {
  return (
    <>
      <style>{`
        @keyframes progress-crawl {
          0% { width: 0%; }
          50% { width: 65%; }
          100% { width: 100%; }
        }
        @keyframes beacon-pulse {
          0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(77,182,172,0.7); }
          70% { transform: scale(1.2); opacity: 0.5; box-shadow: 0 0 0 10px rgba(77,182,172,0); }
          100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(77,182,172,0); }
        }
        .sidebar-header {
          padding: 12px 16px;
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--text-tertiary);
          border-bottom: 1px solid var(--border-primary);
        }
        .node-item {
          display: flex; align-items: center;
          padding: 7px 16px;
          font-family: var(--font-mono); font-size: 12px;
          color: var(--text-secondary);
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
        <TopNav breadcrumb="Main Network" statusLabel="INITIALIZING_SYX" statusColor="gray" showAvatar={false} />

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', flex: 1, overflow: 'hidden' }}>

          {/* Left Sidebar */}
          <aside style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-primary)', opacity: 0.5, display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-header">Network Layers</div>
            <div className="node-item">Global Root</div>
            <div className="node-item" style={{ paddingLeft: 40 }}>Left Leg</div>
            <div className="node-item" style={{ paddingLeft: 40 }}>Right Leg</div>
          </aside>

          {/* Center */}
          <section style={{ position: 'relative', background: 'radial-gradient(ellipse at center, #1a1e26 0%, #0f1115 100%)', overflow: 'hidden' }}>
            <GhostCanvas />

            {/* Hydration status overlay */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: 360,
                background: 'rgba(23,26,33,0.95)',
                border: '1px solid var(--border-secondary)',
                borderRadius: 8,
                backdropFilter: 'blur(12px)',
                padding: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: 'var(--accent-blue)',
                    animation: 'beacon-pulse 2s ease-out infinite',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                    Data Hydration in Progress
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 4, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{
                    height: 4,
                    background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))',
                    borderRadius: 2,
                    animation: 'progress-crawl 5s ease-in-out infinite',
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>45.2% Complete</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>1.2 Gbps</span>
                </div>

                <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-blue)' }}>[FETCH]</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>leg_binary_primary_v2.bin</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: 0.5 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>[MAP]</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>node_mapping_recursive...</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Right Sidebar */}
          <aside style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', opacity: 0.3, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>System Properties</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>PENDING</span>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {['Hierarchy Engine', 'Performance Decay', 'Leg Balancing', 'Binary Visualizer'].map(label => (
                <div key={label}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
                  <div style={{ height: 28, background: 'var(--bg-inset)', borderRadius: 4 }} />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
