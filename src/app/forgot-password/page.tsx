'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setError('가입할 때 사용한 이메일 주소를 입력해주세요.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) {
      // 존재하지 않는 이메일도 보안상 성공처럼 처리되지만, rate limit 등은 표시
      if (error.message.includes('rate limit') || error.status === 429) {
        setError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')
        return
      }
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .field-input {
          width: 100%;
          background: rgba(10,12,16,0.8);
          border: 1px solid #242a35;
          color: #e0e6ed;
          padding: 12px 14px;
          border-radius: 3px;
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.25s, box-shadow 0.25s;
          box-sizing: border-box;
        }
        .field-input:focus {
          border-color: #4db6ac;
          box-shadow: 0 0 0 3px rgba(77,182,172,0.08);
        }
        .field-input::placeholder { color: #64748b; }
        .btn-submit {
          width: 100%;
          background: #4db6ac;
          color: #07080a;
          border: none;
          padding: 13px;
          border-radius: 3px;
          font-family: var(--font-main);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.25s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-submit:hover:not(:disabled) {
          background: #5ec8be;
          box-shadow: 0 0 20px rgba(77,182,172,0.25);
          transform: translateY(-1px);
        }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(7,8,10,0.3);
          border-top-color: #07080a;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
      `}</style>

      <main style={{ backgroundColor: '#07080a', height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle at center, rgba(77,182,172,0.05) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 380, animation: 'fadeInUp 0.8s ease-out both', padding: '0 16px' }}>

          {/* Brand */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 36 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85, filter: 'drop-shadow(0 0 10px rgba(77,182,172,0.3))' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.35em', textTransform: 'uppercase', color: '#4db6ac', opacity: 0.8 }}>
              RCT Platform
            </span>
          </div>

          {/* Card */}
          <div style={{ background: 'rgba(17,20,27,0.85)', backdropFilter: 'blur(20px)', border: '1px solid #242a35', borderRadius: 6, overflow: 'hidden' }}>

            <div style={{ padding: '20px 24px 0' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e0e6ed', letterSpacing: '-0.01em' }}>비밀번호 찾기</h2>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.6 }}>
                가입한 이메일 주소를 입력하면<br/>비밀번호 재설정 링크를 보내드립니다.
              </p>
            </div>

            <div style={{ height: 1, background: '#242a35', margin: '20px 0 0' }} />

            {sent ? (
              /* ── 발송 완료 ── */
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(77,182,172,0.12)', border: '2px solid rgba(77,182,172,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e6ed', marginBottom: 6 }}>메일을 확인해주세요</div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                    <span style={{ color: '#94a3b8' }}>{email.trim()}</span> 으로<br/>
                    재설정 링크를 보냈습니다. 받은 편지함과<br/>스팸함을 확인해주세요.
                  </div>
                </div>
                <Link href="/login" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', padding: '11px', boxSizing: 'border-box',
                  border: '1px solid #323a48', borderRadius: 3,
                  fontSize: 13, fontWeight: 500, color: '#94a3b8',
                  textDecoration: 'none', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#4db6ac'; e.currentTarget.style.color = '#4db6ac' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#323a48'; e.currentTarget.style.color = '#94a3b8' }}
                >
                  로그인으로 돌아가기
                </Link>
              </div>
            ) : (
              /* ── 이메일 입력 폼 ── */
              <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                    이메일
                  </label>
                  <input
                    type="email"
                    className="field-input"
                    placeholder="가입한 이메일 주소"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 3 }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? (<><span className="spinner" />발송 중...</>) : '재설정 링크 보내기'}
                </button>

                <Link href="/login" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none', textAlign: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
                >
                  ← 로그인으로 돌아가기
                </Link>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
