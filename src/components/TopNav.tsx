'use client'
import Link from 'next/link'

interface TopNavProps {
  breadcrumb: string
  statusLabel: string
  statusColor?: string
  showAvatar?: boolean
  showPulseDot?: boolean
}

export default function TopNav({
  breadcrumb,
  statusLabel,
  statusColor = '#4db6ac',
  showAvatar = true,
  showPulseDot = false,
}: TopNavProps) {
  return (
    <header
      className="flex items-center justify-between px-5 shrink-0"
      style={{
        height: 48,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-primary)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="2" y="5" width="18" height="3" rx="1" stroke="#4db6ac" strokeWidth="1.5" />
          <rect x="2" y="10" width="18" height="3" rx="1" stroke="#4db6ac" strokeWidth="1.5" opacity="0.7" />
          <rect x="2" y="15" width="18" height="3" rx="1" stroke="#4db6ac" strokeWidth="1.5" opacity="0.4" />
        </svg>
        <span
          className="font-mono text-xs tracking-widest uppercase"
          style={{ color: 'var(--accent-blue)', letterSpacing: '0.12em' }}
        >
          Aetheris
        </span>
        <span style={{ color: 'var(--border-secondary)' }}>/</span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {breadcrumb}
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {showPulseDot && (
          <span
            className="inline-block w-2 h-2 rounded-full animate-beacon"
            style={{ background: statusColor }}
          />
        )}
        <span
          className="font-mono text-xs px-2 py-1 rounded"
          style={{
            color: statusColor,
            background: `${statusColor}18`,
            border: `1px solid ${statusColor}40`,
            letterSpacing: '0.08em',
          }}
        >
          {statusLabel}
        </span>
        {showAvatar && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold"
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-secondary)',
              color: 'var(--accent-blue)',
            }}
          >
            A
          </div>
        )}
      </div>
    </header>
  )
}
