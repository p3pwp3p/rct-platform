'use client'
import Link from 'next/link'
import TopNav from '@/components/TopNav'
import Sidebar from '@/components/Sidebar'
import SidebarHeader from '@/components/SidebarHeader'

export default function InitPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <TopNav breadcrumb="Network Init" statusLabel="STANDBY_MODE" statusColor="#94a3b8" />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar>
          <SidebarHeader label="Network Layers" />
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
              style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-primary)' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" />
              </svg>
            </div>
            <p className="font-mono text-[11px] text-center" style={{ color: 'var(--text-tertiary)' }}>
              네트워크 비어 있음
            </p>
            <p className="font-mono text-[10px] text-center mt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>
              첫 노드를 생성하세요
            </p>
          </div>
          <div style={{ borderTop: '1px solid var(--border-primary)' }}>
            <SidebarHeader label="Assets" />
            <div className="px-4 py-3 space-y-2">
              {['Documentation', 'Quick Start', 'API Reference'].map(a => (
                <div key={a} className="font-mono text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  {a}
                </div>
              ))}
            </div>
          </div>
        </Sidebar>

        {/* Canvas area */}
        <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
          {/* Animated geometric shapes */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Rotating square */}
            <div
              className="absolute animate-spin-slow"
              style={{ width: 260, height: 260, border: '1px solid rgba(36,42,53,0.6)', borderRadius: 4 }}
            />
            {/* Dashed circle */}
            <div
              className="absolute animate-spin-slow-reverse"
              style={{
                width: 200,
                height: 200,
                border: '1px dashed rgba(77,182,172,0.2)',
                borderRadius: '50%',
              }}
            />
            {/* Diamond */}
            <div
              className="absolute animate-spin-slow"
              style={{
                width: 140,
                height: 140,
                border: '1px solid rgba(157,80,187,0.2)',
                transform: 'rotate(45deg)',
              }}
            />
            {/* Center cross+circle */}
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="30" stroke="rgba(77,182,172,0.3)" strokeWidth="1" />
              <circle cx="40" cy="40" r="4" fill="rgba(77,182,172,0.5)" />
              <line x1="40" y1="10" x2="40" y2="70" stroke="rgba(77,182,172,0.2)" strokeWidth="1" />
              <line x1="10" y1="40" x2="70" y2="40" stroke="rgba(77,182,172,0.2)" strokeWidth="1" />
            </svg>
            {/* Scanner line */}
            <div
              className="absolute left-0 right-0 animate-scan pointer-events-none"
              style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(77,182,172,0.4), transparent)',
              }}
            />
          </div>

          {/* Hero text overlay */}
          <div className="relative z-10 flex flex-col items-center gap-6 text-center px-8 animate-fadeIn">
            <div
              className="font-mono text-[11px] tracking-widest px-3 py-1 rounded"
              style={{
                color: '#94a3b8',
                background: 'rgba(148,163,184,0.1)',
                border: '1px solid rgba(148,163,184,0.2)',
              }}
            >
              NETWORK_EMPTY // AWAITING_INIT
            </div>
            <h2
              className="font-main text-2xl font-semibold leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              시스템이 네트워크 초기화를<br />준비했습니다
            </h2>
            <p className="font-mono text-xs max-w-sm" style={{ color: 'var(--text-secondary)' }}>
              바이너리 레그 구조로 네트워크를 구성하세요.<br />
              첫 번째 노드를 생성하여 시작하십시오.
            </p>
            <Link
              href="/signup"
              className="font-mono text-sm tracking-wider px-8 py-3 rounded transition-all"
              style={{
                background: 'var(--accent-blue)',
                color: 'var(--bg-base)',
                border: '1px solid var(--accent-blue)',
              }}
            >
              첫 번째 노드 생성
            </Link>

            {/* Tip cards */}
            <div className="grid grid-cols-3 gap-3 mt-4 w-full max-w-lg">
              {[
                { title: 'Root Positioning', desc: '루트 노드 기반 최적 배치' },
                { title: 'Secure Validation', desc: '이중 검증 보안 프로토콜' },
                { title: 'Auto-Balancing', desc: '레그 자동 균형 조정' },
              ].map(tip => (
                <div
                  key={tip.title}
                  className="glass rounded-lg p-3 text-left"
                >
                  <div className="font-mono text-[10px] tracking-wider mb-1" style={{ color: 'var(--accent-blue)' }}>
                    {tip.title}
                  </div>
                  <div className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {tip.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
