'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name || !email || !password) {
      setError('이름, 이메일, 비밀번호는 필수 항목입니다.')
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.')
      return
    }
    if (!agreed) {
      setError('이용약관에 동의해주세요.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    })
    setLoading(false)

    if (error) {
      if (error.message.includes('already registered')) {
        setError('이미 가입된 이메일 주소입니다.')
      } else {
        setError(error.message)
      }
      return
    }

    setSuccess(true)
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .su-input {
          width: 100%;
          background: rgba(10,12,16,0.8);
          border: 1px solid #242a35;
          color: #e0e6ed;
          padding: 11px 14px;
          border-radius: 3px;
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .su-input:focus {
          border-color: #4db6ac;
          box-shadow: 0 0 0 3px rgba(77,182,172,0.08);
        }
        .su-input::placeholder { color: #64748b; }

        .su-btn {
          width: 100%;
          background: #4db6ac;
          color: #07080a;
          border: none;
          padding: 13px;
          border-radius: 3px;
          font-family: var(--font-main);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .su-btn:hover:not(:disabled) {
          background: #5ec8be;
          box-shadow: 0 0 20px rgba(77,182,172,0.25);
          transform: translateY(-1px);
        }
        .su-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(7,8,10,0.3);
          border-top-color: #07080a;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .check-box {
          width: 16px; height: 16px;
          border: 1px solid #323a48;
          border-radius: 3px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s;
          background: rgba(10,12,16,0.8);
        }
        .check-box.checked {
          background: #4db6ac;
          border-color: #4db6ac;
        }
      `}</style>

      <main style={{ minHeight: '100vh', backgroundColor: '#07080a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', position: 'relative' }}>
        {/* Background grid */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.015) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.015) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, animation: 'fadeInUp 1.4s ease-out both' }}>

          {/* Brand */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px rgba(77,182,172,0.3))' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.35em', textTransform: 'uppercase', color: '#4db6ac', opacity: 0.8 }}>RCT Platform</span>
          </div>

          {/* Card */}
          <div style={{ background: 'rgba(17,20,27,0.9)', backdropFilter: 'blur(20px)', border: '1px solid #242a35', borderRadius: 6, overflow: 'hidden' }}>

            <div style={{ padding: '20px 24px 0' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e0e6ed', letterSpacing: '-0.01em' }}>회원가입</h2>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>RCT 네트워크에 새 노드를 등록하세요.</p>
            </div>

            <div style={{ height: 1, background: '#242a35', margin: '18px 0 0' }} />

            {success ? (
              /* Success state */
              <div style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(77,182,172,0.1)', border: '1px solid #4db6ac', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#e0e6ed', marginBottom: 6 }}>가입 신청 완료</p>
                  <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>입력하신 이메일로 인증 링크를 발송했습니다.<br />메일함을 확인하여 인증을 완료해주세요.</p>
                </div>
                <Link href="/login" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '10px 24px', border: '1px solid #4db6ac', borderRadius: 3,
                  fontSize: 13, color: '#4db6ac', textDecoration: 'none',
                  fontFamily: 'var(--font-main)', fontWeight: 500,
                  letterSpacing: '0.02em',
                  transition: 'all 0.2s',
                }}>
                  로그인으로 이동
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* 이름 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>이름</label>
                  <input className="su-input" type="text" placeholder="홍길동" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
                </div>

                {/* 이메일 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>이메일</label>
                  <input className="su-input" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                </div>

                {/* 비밀번호 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>비밀번호</label>
                  <input className="su-input" type="password" placeholder="8자 이상" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                </div>

                {/* 비밀번호 확인 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>비밀번호 확인</label>
                  <input className="su-input" type="password" placeholder="비밀번호 재입력" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} autoComplete="new-password" />
                </div>

                {/* 약관 동의 */}
                <div
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 0' }}
                  onClick={() => setAgreed(v => !v)}
                >
                  <div className={`check-box${agreed ? ' checked' : ''}`}>
                    {agreed && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#07080a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                    <Link href="#" onClick={e => e.stopPropagation()} style={{ color: '#4db6ac', textDecoration: 'none' }}>이용약관</Link> 및{' '}
                    <Link href="#" onClick={e => e.stopPropagation()} style={{ color: '#4db6ac', textDecoration: 'none' }}>개인정보 처리방침</Link>에 동의합니다.
                  </span>
                </div>

                {/* 에러 */}
                {error && (
                  <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 3 }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="su-btn" disabled={loading} style={{ marginTop: 4 }}>
                  {loading ? <><span className="spinner" />처리 중...</> : '노드 등록'}
                </button>

              </form>
            )}

            {!success && (
              <div style={{ padding: '0 24px 20px', textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>이미 계정이 있으신가요? </span>
                <Link href="/login" style={{ fontSize: 12, color: '#4db6ac', textDecoration: 'none' }}>로그인</Link>
              </div>
            )}
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#64748b', opacity: 0.4 }}>RCT OS // Gateway Node</span>
          </div>
        </div>
      </main>
    </>
  )
}
