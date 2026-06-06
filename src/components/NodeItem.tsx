interface NodeItemProps {
  label: string
  indent?: number
  active?: boolean
  opacity?: number
  value?: string
}

export default function NodeItem({ label, indent = 0, active = false, opacity = 1, value }: NodeItemProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 cursor-default"
      style={{
        paddingLeft: `${16 + indent * 12}px`,
        opacity,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: active ? 'var(--accent-blue)' : 'var(--border-secondary)',
            boxShadow: active ? '0 0 4px var(--accent-blue)' : 'none',
          }}
        />
        <span
          className="text-xs font-mono"
          style={{ color: active ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
        >
          {label}
        </span>
      </div>
      {value && (
        <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          {value}
        </span>
      )}
    </div>
  )
}
