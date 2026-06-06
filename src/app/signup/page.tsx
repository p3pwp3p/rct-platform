'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TopNav from '@/components/TopNav'

const RANKS = ['SILVER I', 'GOLD II', 'PLATINUM III', 'DIAMOND', 'CROWN', 'LEGACY']
const ACTIVE_RANKS = ['SILVER I', 'GOLD II']

export default function SignupPage() {
  const router = useRouter()
  const [leg, setLeg] = useState<'LEFT' | 'RIGHT'>('LEFT')
  const [activeRanks, setActiveRanks] = useState<Set<string>>(new Set(ACTIVE_RANKS))

  const toggleRank = (rank: string) => {
    setActiveRanks(prev => {
      const next = new Set(prev)
      if (next.has(rank)) next.delete(rank)
      else next.add(rank)
      return next
    })
  }

  return (
    <>
      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Blurred background layout */}
      <div style={{ filter: 'blur(4px) brightness(0.5)', position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', pointerEvents: 'none' }}>
        <TopNav breadcrumb="Main Network" statusLabel="LIVE_NETWORK_O1" statusColor="accent" showPulseDot showAvatar />
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', flex: 1, overflow: 'hidden' }}>
          {/* Left sidebar */}
          <aside style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-primary)' }} />
          {/* Canvas */}
          <section style={{ background: 'radial-gradient(ellipse at center, #1a1e26 0%, #0f1115 100%)' }} />
          {/* Right sidebar */}
          <aside style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-primary)' }} />
        </div>
      </div>

      {/* Modal backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}>
        <div style={{
          width: 480,
          background: 'rgba(23,26,33,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid var(--border-secondary)',
          borderRadius: 8,
          animation: 'modalPop 0.25s ease-out both',
        }}>
          {/* Modal header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-primary)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
              Initialize New Node
            </span>
            <button
              onClick={() => router.back()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Modal body */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Node Identifier */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                Node Identifier
              </label>
              <input
                type="text"
                defaultValue="AETHER_NODE_882"
                placeholder="e.g. ALPHA_VANGUARD_01"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px',
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-secondary)',
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            {/* Leg Assignment */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                Leg Assignment
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['LEFT', 'RIGHT'] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => setLeg(l)}
                    style={{
                      padding: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      letterSpacing: '0.08em',
                      cursor: 'pointer',
                      borderRadius: 4,
                      border: `1px solid ${leg === l ? 'var(--accent-blue)' : 'var(--border-secondary)'}`,
                      background: leg === l ? 'var(--accent-blue-dim)' : 'var(--bg-inset)',
                      color: leg === l ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {l === 'LEFT' ? 'LEFT (PRIMARY)' : 'RIGHT (SECONDARY)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Parent Node Path */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                Parent Node Path
              </label>
              <select style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-secondary)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                outline: 'none',
              }}>
                <option>ROOT / L-ALPHA</option>
                <option>ROOT / R-BETA</option>
                <option>ROOT / L-ALPHA / L-01</option>
              </select>
            </div>

            {/* Rank Tier Requirement */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                Rank Tier Requirement
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {RANKS.map(rank => {
                  const isActive = activeRanks.has(rank)
                  return (
                    <button
                      key={rank}
                      onClick={() => toggleRank(rank)}
                      style={{
                        padding: '8px 4px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        borderRadius: 4,
                        border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                        background: isActive ? 'var(--accent-blue-dim)' : 'var(--bg-inset)',
                        color: isActive ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                        opacity: isActive ? 1 : 0.5,
                        transition: 'all 0.15s',
                      }}
                    >
                      {rank}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Modal footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
            padding: '12px 20px',
            background: 'rgba(10,12,16,0.5)',
            borderTop: '1px solid var(--border-primary)',
            borderRadius: '0 0 8px 8px',
          }}>
            <button
              onClick={() => router.back()}
              style={{
                padding: '8px 16px',
                fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em',
                cursor: 'pointer', borderRadius: 4,
                border: '1px solid var(--border-secondary)',
                background: 'transparent',
                color: 'var(--text-tertiary)',
              }}
            >
              Discard
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '8px 20px',
                fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em',
                cursor: 'pointer', borderRadius: 4,
                border: '1px solid var(--accent-blue)',
                background: 'var(--accent-blue)',
                color: '#0f1115',
                fontWeight: 600,
              }}
            >
              Deploy Node
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
