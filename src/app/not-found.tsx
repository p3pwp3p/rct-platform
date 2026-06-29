import Link from 'next/link'

// 존재하지 않는 경로 진입 시 404 화면.
export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 24, boxSizing: 'border-box',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 56, fontWeight: 700, color: 'var(--accent-blue)', lineHeight: 1, marginBottom: 14 }}>
          404
        </div>
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          페이지를 찾을 수 없습니다
        </div>
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: 24 }}>
          주소가 바뀌었거나 삭제된 페이지일 수 있습니다.
        </div>
        <Link href="/" style={{
          display: 'inline-block', padding: '10px 22px', borderRadius: 7, textDecoration: 'none',
          background: 'var(--accent-blue)', color: '#000',
          fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700,
        }}>
          홈으로
        </Link>
      </div>
    </div>
  )
}
