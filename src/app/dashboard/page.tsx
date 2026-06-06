'use client'
import { useState } from 'react'
import Link from 'next/link'
import TopNav from '@/components/TopNav'
import Sidebar from '@/components/Sidebar'
import SidebarHeader from '@/components/SidebarHeader'
import NodeItem from '@/components/NodeItem'
import NetworkCanvas from '@/components/NetworkCanvas'
import FloatingCard from '@/components/FloatingCard'

export default function DashboardPage() {
  const [decay, setDecay] = useState(32)
  const [depth, setDepth] = useState(6)
  const [spacing, setSpacing] = useState(48)
  const [legBalance, setLegBalance] = useState<'L-HEAVY' | 'R-AUTO'>('L-HEAVY')

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <TopNav breadcrumb="Network Command" statusLabel="LIVE_NETWORK_O1" showPulseDot />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar>
          <SidebarHeader label="Network Layers" rightElement={
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ color: '#4db6ac', background: 'rgba(77,182,172,0.1)', border: '1px solid rgba(77,182,172,0.2)' }}>LIVE</span>
          } />
          <div className="py-1">
            <NodeItem label="Global Root" active />
            <NodeItem label="Left Leg" indent={1} />
            <NodeItem label="Alpha Group" indent={2} active />
            <NodeItem label="Beta Group" indent={2} />
            <NodeItem label="Right Leg" indent={1} />
            <NodeItem label="Gamma Branch" indent={2} />
            <NodeItem label="Active Nodes" indent={1} value="42" active />
          </div>
          <div style={{ borderTop: '1px solid var(--border-primary)', marginTop: 'auto' }}>
            <SidebarHeader label="Assets" />
            <div className="px-4 py-3 space-y-2">
              <Link href="/dashboard/analytics" className="block font-mono text-[11px] transition-colors hover:text-white" style={{ color: 'var(--text-tertiary)' }}>
                → Analytics
              </Link>
              <Link href="/network" className="block font-mono text-[11px] transition-colors hover:text-white" style={{ color: 'var(--text-tertiary)' }}>
                → Global Network
              </Link>
              <Link href="/signup" className="block font-mono text-[11px] transition-colors hover:text-white" style={{ color: 'var(--text-tertiary)' }}>
                → Initialize Node
              </Link>
            </div>
          </div>
        </Sidebar>

        {/* Center Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <NetworkCanvas />

          {/* Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
            {/* Top hero */}
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                BINARY_NETWORK // VISUALIZATION
              </span>
              <h2 className="font-main text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                네트워크 커맨드 센터
              </h2>
            </div>

            {/* CTA buttons - pointer-events on */}
            <div className="pointer-events-auto flex gap-2">
              <Link
                href="/signup"
                className="font-mono text-xs tracking-wider px-4 py-2 rounded transition-all"
                style={{
                  background: 'var(--accent-blue)',
                  color: 'var(--bg-base)',
                }}
              >
                노드 추가
              </Link>
              <Link
                href="/dashboard/analytics"
                className="font-mono text-xs tracking-wider px-4 py-2 rounded transition-all"
                style={{
                  border: '1px solid var(--border-secondary)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-surface)',
                }}
              >
                분석 보기
              </Link>
            </div>
          </div>

          {/* Floating Cards */}
          <FloatingCard
            style={{ position: 'absolute', top: 80, right: 24, width: 160 }}
            animationDelay="0s"
          >
            <div className="font-mono text-[10px] mb-1" style={{ color: 'var(--text-tertiary)' }}>Current Rank</div>
            <div className="font-mono text-sm font-bold" style={{ color: '#4db6ac' }}>Platinum II</div>
            <div className="font-mono text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>다음 직급까지 78%</div>
          </FloatingCard>

          <FloatingCard
            style={{ position: 'absolute', bottom: 80, right: 24, width: 160 }}
            animationDelay="1.2s"
          >
            <div className="font-mono text-[10px] mb-1" style={{ color: 'var(--text-tertiary)' }}>Total Volume</div>
            <div className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>142.8k PV</div>
            <div className="font-mono text-[10px] mt-1" style={{ color: '#4db6ac' }}>+12.4% 이번 달</div>
          </FloatingCard>

          {/* Bottom Toolbar */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 px-4 pointer-events-auto"
            style={{
              height: 44,
              background: 'rgba(23,26,33,0.9)',
              borderTop: '1px solid var(--border-primary)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {[
              { icon: '⌂', label: 'Home', href: '/dashboard' },
              { icon: '◫', label: 'Network', href: '/network' },
              { icon: '◷', label: 'Analytics', href: '/dashboard/analytics' },
              { icon: '✦', label: 'Init', href: '/init' },
            ].map(btn => (
              <Link
                key={btn.label}
                href={btn.href}
                className="flex flex-col items-center gap-0.5 transition-opacity hover:opacity-100"
                style={{ opacity: 0.5 }}
                title={btn.label}
              >
                <span className="text-sm" style={{ color: 'var(--accent-blue)' }}>{btn.icon}</span>
                <span className="font-mono text-[9px]" style={{ color: 'var(--text-tertiary)' }}>{btn.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Sidebar — System Properties */}
        <div
          className="w-56 shrink-0 flex flex-col overflow-y-auto"
          style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-primary)' }}
        >
          <SidebarHeader label="System Properties" />

          <div className="p-4 space-y-5">
            {/* Hierarchy Engine */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest block mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Hierarchy Engine
              </label>
              <select
                className="w-full px-2 py-1.5 rounded font-mono text-xs outline-none"
                style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
              >
                <option>BINARY_V3</option>
                <option>BINARY_V2</option>
                <option>UNILEVEL</option>
              </select>
            </div>

            {/* Performance Decay */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                  Perf. Decay
                </label>
                <span className="font-mono text-[10px]" style={{ color: 'var(--accent-blue)' }}>{decay}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={decay}
                onChange={e => setDecay(Number(e.target.value))}
                className="w-full accent-teal-400"
              />
            </div>

            {/* Active Leg Balancing */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest block mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Leg Balancing
              </label>
              <div className="flex gap-1">
                {(['L-HEAVY', 'R-AUTO'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setLegBalance(v)}
                    className="flex-1 py-1 rounded font-mono text-[10px] tracking-wider transition-all"
                    style={{
                      border: `1px solid ${legBalance === v ? 'var(--accent-blue)' : 'var(--border-secondary)'}`,
                      background: legBalance === v ? 'var(--accent-blue-dim)' : 'var(--bg-inset)',
                      color: legBalance === v ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Binary Visualizer */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest block mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Binary Visualizer
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Depth</span>
                  <input
                    type="number" value={depth} min={1} max={10}
                    onChange={e => setDepth(Number(e.target.value))}
                    className="w-14 px-2 py-0.5 rounded font-mono text-xs text-right outline-none"
                    style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Spacing</span>
                  <input
                    type="number" value={spacing} min={20} max={120} step={4}
                    onChange={e => setSpacing(Number(e.target.value))}
                    className="w-14 px-2 py-0.5 rounded font-mono text-xs text-right outline-none"
                    style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
