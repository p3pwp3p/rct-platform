'use client'

// 대시보드 세그먼트 로딩 폴백.
// 레이아웃(상단바·사이드바)은 그대로 유지되고 콘텐츠 영역에만 표시되므로
// 화면 전체를 다시 그리지 않는 차분한 로더만 둔다.
export default function DashboardLoading() {
  return (
    <>
      <style>{`
        @keyframes loaderSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes loaderFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        // 빠른 전환에서는 로더가 깜빡이지 않도록 살짝 늦게 나타남
        animation: 'loaderFadeIn 0.2s ease-out 0.15s both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 14, height: 14,
            border: '2px solid var(--border-secondary)',
            borderTopColor: 'var(--accent-blue)',
            borderRadius: '50%',
            animation: 'loaderSpin 0.7s linear infinite',
          }} />
          <span style={{
            fontFamily: 'var(--font-main)', fontSize: 12,
            color: 'var(--text-tertiary)',
          }}>
            불러오는 중
          </span>
        </div>
      </div>
    </>
  )
}
