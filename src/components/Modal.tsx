'use client'
import { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}

export default function Modal({ title, onClose, children, footer }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(10,12,16,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="animate-modalPop rounded-xl w-full max-w-md"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-secondary)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <span className="font-mono text-sm tracking-wider" style={{ color: 'var(--text-primary)' }}>
            {title}
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-xs hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">{children}</div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4"
          style={{ borderTop: '1px solid var(--border-primary)' }}
        >
          {footer}
        </div>
      </div>
    </div>
  )
}
