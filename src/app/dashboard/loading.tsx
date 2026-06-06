'use client'
import TopNav from '@/components/TopNav'
import Sidebar from '@/components/Sidebar'
import SidebarHeader from '@/components/SidebarHeader'
import NodeItem from '@/components/NodeItem'
import NetworkCanvas from '@/components/NetworkCanvas'

const DATA_STREAMS = [
  { label: 'Node registry sync', status: 'LOADED', color: '#4db6ac' },
  { label: 'Binary tree topology', status: 'LOADED', color: '#4db6ac' },
  { label: 'Volume metrics', status: '78%', color: '#f59e0b' },
  { label: 'Rank calculations', status: 'PENDING', color: '#64748b' },
  { label: 'Analytics engine', status: 'PENDING', color: '#64748b' },
]

export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <TopNav breadcrumb="Network Command" statusLabel="INITIALIZING_SYX" statusColor="#f59e0b" />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — dimmed */}
        <Sidebar>
          <SidebarHeader label="Network Layers" />
          <div className="py-1">
            <NodeItem label="Global Root" opacity={0.3} />
            <NodeItem label="Left Leg" indent={1} opacity={0.2} />
            <NodeItem label="Alpha Group" indent={2} opacity={0.15} />
            <NodeItem label="Right Leg" indent={1} opacity={0.2} />
          </div>
        </Sidebar>

        {/* Center Canvas with overlay */}
        <div className="flex-1 relative overflow-hidden">
          <NetworkCanvas dim />

          {/* Hydration overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="animate-modalPop rounded-xl w-full max-w-sm p-5"
              style={{
                background: 'rgba(23,26,33,0.95)',
                border: '1px solid var(--border-secondary)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center animate-spin-slow"
                  style={{ border: '2px solid var(--accent-blue)', borderTopColor: 'transparent' }}
                />
                <div>
                  <div className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                    Data Hydration in Progress
                  </div>
                  <div className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    NETWORK_SYNC // SYX_ENGINE
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div
                className="h-1.5 rounded-full overflow-hidden mb-4"
                style={{ background: 'var(--bg-inset)' }}
              >
                <div
                  className="h-1.5 rounded-full animate-progress"
                  style={{ background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))' }}
                />
              </div>

              {/* Stream items */}
              <div className="space-y-2">
                {DATA_STREAMS.map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {s.label}
                    </span>
                    <span className="font-mono text-[10px]" style={{ color: s.color }}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar — dimmed */}
        <div
          className="w-56 shrink-0 flex flex-col"
          style={{
            background: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border-primary)',
            opacity: 0.35,
          }}
        >
          <SidebarHeader label="System Properties" />
          <div className="p-4 space-y-3">
            {['Hierarchy Engine', 'Perf. Decay', 'Leg Balancing', 'Visualizer'].map(l => (
              <div key={l}>
                <div className="font-mono text-[10px] mb-1 uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                  {l}
                </div>
                <div className="h-6 rounded" style={{ background: 'var(--bg-inset)' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
