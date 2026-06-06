'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TopNav from '@/components/TopNav'
import Sidebar from '@/components/Sidebar'
import SidebarHeader from '@/components/SidebarHeader'
import NodeItem from '@/components/NodeItem'
import Modal from '@/components/Modal'
import NetworkCanvas from '@/components/NetworkCanvas'

const RANKS = ['SILVER I', 'GOLD II', 'PLATINUM III', 'DIAMOND', 'CROWN', 'LEGACY']
const RANK_COLORS: Record<string, string> = {
  'SILVER I': '#94a3b8',
  'GOLD II': '#f59e0b',
  'PLATINUM III': '#4db6ac',
  'DIAMOND': '#60a5fa',
  'CROWN': '#c084fc',
  'LEGACY': '#f97316',
}

export default function SignupPage() {
  const router = useRouter()
  const [leg, setLeg] = useState<'LEFT' | 'RIGHT'>('LEFT')
  const [selectedRank, setSelectedRank] = useState('SILVER I')
  const [nodeId, setNodeId] = useState('')

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ filter: 'blur(2px)', background: 'var(--bg-base)' }}>
      {/* Blurred background layout */}
      <TopNav breadcrumb="Network Command" statusLabel="LIVE_NETWORK_O1" showPulseDot />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar>
          <SidebarHeader label="Network Layers" />
          <div className="py-2">
            <NodeItem label="Global Root" active />
            <NodeItem label="Left Leg" indent={1} />
            <NodeItem label="Right Leg" indent={1} />
          </div>
        </Sidebar>
        <div className="flex-1 relative">
          <NetworkCanvas />
        </div>
        <div className="w-56 shrink-0" style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-primary)' }} />
      </div>

      {/* Modal overlay - not blurred */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(10,12,16,0.8)', backdropFilter: 'blur(8px)', filter: 'none' }}
      >
        <div
          className="animate-modalPop rounded-xl w-full max-w-md"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-secondary)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            filter: 'none',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <div>
              <span className="font-mono text-sm tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Initialize New Node
              </span>
              <p className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                NODE_INIT // BINARY_PLACEMENT
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="w-6 h-6 rounded flex items-center justify-center text-xs hover:bg-white/5 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-5">
            {/* Node Identifier */}
            <div>
              <label className="font-mono text-[11px] uppercase tracking-widest block mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Node Identifier
              </label>
              <input
                type="text"
                value={nodeId}
                onChange={e => setNodeId(e.target.value)}
                placeholder="node_identifier_alpha"
                className="w-full px-3 py-2 rounded font-mono text-sm outline-none transition-colors"
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Leg Assignment */}
            <div>
              <label className="font-mono text-[11px] uppercase tracking-widest block mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Leg Assignment
              </label>
              <div className="flex gap-2">
                {(['LEFT', 'RIGHT'] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => setLeg(l)}
                    className="flex-1 py-2 rounded font-mono text-xs tracking-wider transition-all"
                    style={{
                      border: `1px solid ${leg === l ? 'var(--accent-blue)' : 'var(--border-secondary)'}`,
                      background: leg === l ? 'var(--accent-blue-dim)' : 'var(--bg-inset)',
                      color: leg === l ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Parent Node Path */}
            <div>
              <label className="font-mono text-[11px] uppercase tracking-widest block mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Parent Node Path
              </label>
              <select
                className="w-full px-3 py-2 rounded font-mono text-sm outline-none"
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-secondary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option>ROOT / L-ALPHA</option>
                <option>ROOT / R-BETA</option>
                <option>ROOT / L-ALPHA / L-01</option>
                <option>ROOT / R-BETA / R-03</option>
              </select>
            </div>

            {/* Rank Tier */}
            <div>
              <label className="font-mono text-[11px] uppercase tracking-widest block mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Rank Tier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {RANKS.map(rank => (
                  <button
                    key={rank}
                    onClick={() => setSelectedRank(rank)}
                    className="py-2 px-2 rounded font-mono text-[10px] tracking-wide transition-all"
                    style={{
                      border: `1px solid ${selectedRank === rank ? RANK_COLORS[rank] : 'var(--border-secondary)'}`,
                      background: selectedRank === rank ? `${RANK_COLORS[rank]}18` : 'var(--bg-inset)',
                      color: selectedRank === rank ? RANK_COLORS[rank] : 'var(--text-tertiary)',
                    }}
                  >
                    {rank}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded font-mono text-xs tracking-wider transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-tertiary)', border: '1px solid var(--border-secondary)' }}
            >
              Discard
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-5 py-2 rounded font-mono text-xs tracking-wider transition-all"
              style={{
                background: 'var(--accent-blue)',
                color: 'var(--bg-base)',
                border: '1px solid var(--accent-blue)',
              }}
            >
              Deploy Node
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
