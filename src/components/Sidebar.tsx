import { ReactNode } from 'react'

interface SidebarProps {
  children: ReactNode
  width?: number
}

export default function Sidebar({ children, width = 220 }: SidebarProps) {
  return (
    <aside
      className="flex flex-col shrink-0 overflow-y-auto"
      style={{
        width,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-primary)',
      }}
    >
      {children}
    </aside>
  )
}
