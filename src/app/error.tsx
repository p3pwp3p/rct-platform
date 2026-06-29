'use client'

// 라우트 세그먼트에서 던져진 에러를 잡는 바운더리.
// 화면 전체가 흰 페이지로 죽는 대신, 다시 시도/홈 이동을 제공한다.
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[route error]', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 24, boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: 420, width: '100%', textAlign: 'center',
        background: 'var(--bg-surface)', border: '1px solid var(--border-primary)',
        borderRadius: 12, padding: '32px 28px',
      }}>
        <div style={{
          width: 52, height: 52, margin: '0 auto 18px', borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          문제가 발생했습니다
        </div>
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: 22 }}>
          페이지를 불러오는 중 오류가 생겼습니다.<br />다시 시도하거나 잠시 후 접속해 주세요.
        </div>
        {error.digest && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 18, opacity: 0.7 }}>
            ref: {error.digest}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reset} style={{
            padding: '10px 20px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: 'var(--accent-blue)', color: '#000',
            fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700,
          }}>
            다시 시도
          </button>
          <Link href="/" style={{
            padding: '10px 20px', borderRadius: 7, textDecoration: 'none',
            border: '1px solid var(--border-secondary)', color: 'var(--text-secondary)',
            fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600,
          }}>
            홈으로
          </Link>
        </div>
      </div>
    </div>
  )
}
