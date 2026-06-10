import React from 'react'

export type StatusKey = 'pending' | 'approved' | 'active' | 'inactive' | 'rejected'

const CONFIG: Record<StatusKey, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: '대기 중',  color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.4)' },
  approved: { label: '승인 완료', color: '#34d399', bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.4)' },
  active:   { label: '활성',     color: '#34d399', bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.4)' },
  inactive: { label: '비활성',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
  rejected: { label: '반려',     color: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)' },
}

export default function StatusBadge({
  status,
  label,
}: {
  status: StatusKey
  label?: string
}) {
  const c = CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 9px',
      borderRadius: 10,
      fontSize: 12,
      fontFamily: 'var(--font-main)',
      fontWeight: 700,
      letterSpacing: '0em',
      color: c.color,
      background: c.bg,
      border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap' as const,
    }}>
      <span style={{
        width: 5, height: 5,
        borderRadius: '50%',
        background: c.color,
        display: 'inline-block',
        flexShrink: 0,
        boxShadow: `0 0 4px ${c.color}`,
      }} />
      {label ?? c.label}
    </span>
  )
}
