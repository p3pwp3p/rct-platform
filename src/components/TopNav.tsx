'use client'
import Link from 'next/link'

interface TopNavProps {
  breadcrumb: string
  statusLabel: string
  statusColor?: 'accent' | 'gray' | 'standby'
  showAvatar?: boolean
  showPulseDot?: boolean
}

export default function TopNav({
  breadcrumb,
  statusLabel,
  statusColor = 'accent',
  showAvatar = true,
  showPulseDot = false,
}: TopNavProps) {
  const color =
    statusColor === 'accent' ? '#4db6ac' :
    statusColor === 'standby' ? '#64748b' :
    '#64748b'

  return (
    <nav style={{
      height: 48,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      flexShrink: 0,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </Link>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-blue)' }}>
          RCT Platform
        </span>
        <span style={{ color: 'var(--border-secondary)' }}>/</span>
        <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)' }}>{breadcrumb}</span>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {showPulseDot && (
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: color,
            display: 'inline-block',
            animation: 'pulse-ring 2s ease-out infinite',
          }} />
        )}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          padding: '3px 8px',
          borderRadius: 4,
          color,
          background: `${color}18`,
          border: `1px solid ${color}40`,
          letterSpacing: '0.08em',
        }}>
          {statusLabel}
        </span>
        {showAvatar && (
          <img
            src="https://i.pravatar.cc/28?img=12"
            alt=""
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-secondary)' }}
          />
        )}
      </div>
    </nav>
  )
}
