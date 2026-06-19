'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Term = { id: string; title: string; body: string; updated_at: string }

export default function TermsPage() {
  const [terms, setTerms] = useState<Term[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/terms')
      .then(r => r.json())
      .then((json: { terms?: Term[] }) => {
        const list = json.terms ?? []
        setTerms(list)
        setActiveId(list[0]?.id ?? null)
      })
      .catch(() => { /* noop */ })
      .finally(() => setLoading(false))
  }, [])

  const active = terms.find(t => t.id === activeId) ?? null

  return (
    <main style={{ minHeight: '100vh', background: '#07080a', color: '#e0e6ed', padding: '40px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            <h1 style={{ fontFamily: 'var(--font-main)', fontSize: 20, fontWeight: 700, color: '#e0e6ed' }}>약관 및 정책</h1>
          </div>
          <Link href="/login" style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: '#64748b', textDecoration: 'none' }}>← 돌아가기</Link>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 14, color: '#64748b' }}>불러오는 중...</div>
        ) : terms.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 14, color: '#64748b', border: '1px dashed #242a35', borderRadius: 10 }}>
            등록된 약관이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
            {/* 카테고리 탭 */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 40 }}>
              {terms.map(t => {
                const on = t.id === activeId
                return (
                  <button key={t.id} onClick={() => setActiveId(t.id)}
                    style={{
                      textAlign: 'left', padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
                      fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: on ? 700 : 500,
                      background: on ? 'rgba(77,182,172,0.1)' : 'transparent',
                      border: `1px solid ${on ? 'rgba(77,182,172,0.4)' : '#242a35'}`,
                      color: on ? '#4db6ac' : '#94a3b8',
                    }}>
                    {t.title}
                  </button>
                )
              })}
            </nav>

            {/* 본문 */}
            <article style={{ background: 'rgba(17,20,27,0.6)', border: '1px solid #242a35', borderRadius: 10, padding: '28px 32px', minHeight: 300 }}>
              {active && (
                <>
                  <h2 style={{ fontFamily: 'var(--font-main)', fontSize: 18, fontWeight: 700, color: '#e0e6ed', marginBottom: 6 }}>{active.title}</h2>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748b', marginBottom: 20 }}>
                    최종 수정: {new Date(active.updated_at).toLocaleDateString('ko-KR')}
                  </div>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 13.5, color: '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {active.body || '내용이 준비 중입니다.'}
                  </div>
                </>
              )}
            </article>
          </div>
        )}
      </div>
    </main>
  )
}
