import { ReactNode } from 'react'

interface SidebarHeaderProps {
  label: string
  rightElement?: ReactNode
}

export default function SidebarHeader({ label, rightElement }: SidebarHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: '1px solid var(--border-primary)' }}
    >
      <span
        className="font-mono text-[11px] uppercase tracking-widest"
        style={{ color: 'var(--text-tertiary)', letterSpacing: '0.14em' }}
      >
        {label}
      </span>
      {rightElement}
    </div>
  )
}
