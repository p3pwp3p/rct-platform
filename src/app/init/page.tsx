'use client'
import Link from 'next/link'
import TopNav from '@/components/TopNav'

export default function InitPage() {
  return (
    <>
      <style>{`
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes rotateReverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes rotateDiamond {
          from { transform: rotate(45deg); }
          to { transform: rotate(405deg); }
        }
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .btn-primary-init {
          display: inline-block;
          padding: 14px 32px;
          background: var(--accent-blue);
          color: #0f1115;
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.05em;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 0 20px rgba(77,182,172,0.3);
          transition: all 0.2s;
        }
        .btn-primary-init:hover {
          box-shadow: 0 0 30px rgba(77,182,172,0.5);
          transform: translateY(-1px);
        }
        .tip-card {
          background: rgba(23,26,33,0.8);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
        <TopNav breadcrumb="Uninitialized Network" statusLabel="STANDBY_MODE" statusColor="standby" showAvatar />

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', flex: 1, overflow: 'hidden' }}>
          {/* Left Sidebar */}
          <aside style={{
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-primary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--text-tertiary)',
              borderBottom: '1px solid var(--border-primary)',
            }}>
              Network Layers
            </div>

            {/* Empty state */}
            <div style={{
              padding: 20,
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              No active layers detected. Initialize root node to begin mapping.
            </div>

            {/* Assets - pushed to bottom */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-primary)' }}>
              <div style={{
                padding: '12px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--text-tertiary)',
                borderBottom: '1px solid var(--border-primary)',
              }}>
                Assets
              </div>
              <div style={{ padding: '8px 16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>Documentation.pdf</div>
              </div>
            </div>
          </aside>

          {/* Canvas area */}
          <section style={{
            background: 'radial-gradient(ellipse at center, #1a1e26 0%, #0f1115 100%)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 48,
            overflow: 'hidden',
            padding: '40px 60px',
          }}>
            {/* Grid lines overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              pointerEvents: 'none',
            }} />

            {/* Abstract container */}
            <div style={{ position: 'relative', width: 300, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {/* Square rotating */}
              <div style={{
                position: 'absolute',
                width: 200, height: 200,
                border: '1px solid var(--accent-blue)',
                opacity: 0.2,
                animation: 'rotate 25s linear infinite',
              }} />
              {/* Circle dashed reverse */}
              <div style={{
                position: 'absolute',
                width: 160, height: 160,
                borderRadius: '50%',
                border: '1px dashed var(--accent-blue)',
                opacity: 0.3,
                animation: 'rotateReverse 15s linear infinite',
              }} />
              {/* Diamond */}
              <div style={{
                position: 'absolute',
                width: 240, height: 240,
                borderRadius: 2,
                border: '1px solid var(--accent-blue)',
                opacity: 0.1,
                animation: 'rotateDiamond 20s linear infinite',
                transform: 'rotate(45deg)',
              }} />
              {/* Scanner line */}
              <div style={{
                position: 'absolute',
                left: 0, right: 0,
                height: 2,
                background: 'linear-gradient(90deg, transparent, var(--accent-blue), transparent)',
                animation: 'scan 4s ease-in-out infinite',
              }} />
              {/* Center crosshair SVG */}
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1 }}>
                <path d="M12 2v20M2 12h20"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>

            {/* Hero content */}
            <div style={{ textAlign: 'center', animation: 'fadeUp 0.8s ease-out both', position: 'relative', zIndex: 1, maxWidth: 600 }}>
              <h1 style={{
                fontSize: 42,
                fontWeight: 700,
                lineHeight: 1.2,
                marginBottom: 16,
                background: 'linear-gradient(180deg, #f8fafc 0%, #94a3b8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                시스템이 네트워크 초기화를 준비했습니다
              </h1>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
                운영 환경이 비어 있습니다. 첫 번째 글로벌 루트 노드를 생성하여 계층 구조를 구성하고 데이터 흐름을 모니터링하세요.
              </p>
              <Link href="/signup" className="btn-primary-init">
                첫 번째 노드 생성
              </Link>
            </div>

            {/* Tip grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: '100%', maxWidth: 700, position: 'relative', zIndex: 1 }}>
              {[
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                  ),
                  title: '루트 포지셔닝',
                  desc: '첫 번째 노드는 이후 모든 레그의 마스터 앵커 역할을 합니다.',
                },
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  ),
                  title: '보안 검증',
                  desc: '각 노드는 라이브 네트워크에 브로드캐스트되기 전 고유 서명이 필요합니다.',
                },
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  ),
                  title: '자동 균형',
                  desc: 'RCT 엔진이 레그 분배를 자동으로 최적화합니다.',
                },
              ].map(tip => (
                <div key={tip.title} className="tip-card">
                  {tip.icon}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{tip.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{tip.desc}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
