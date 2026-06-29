'use client'

// 루트 레이아웃 자체가 깨졌을 때의 최후 폴백.
// 이 컴포넌트는 RootLayout 을 대체하므로 html/body 를 직접 렌더하고,
// CSS 변수(globals.css)가 없을 수 있어 색을 명시한다.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: '#0f1115', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>문제가 발생했습니다</div>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 22 }}>
              앱을 불러오는 중 오류가 생겼습니다. 다시 시도해 주세요.
            </div>
            {error.digest && (
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 18 }}>ref: {error.digest}</div>
            )}
            <button onClick={reset} style={{
              padding: '10px 22px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: '#4db6ac', color: '#000', fontSize: 13, fontWeight: 700,
            }}>
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
