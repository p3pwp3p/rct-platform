'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()

  // 'checking': 복구 세션 확인 중 / 'ready': 새 비밀번호 입력 가능 /
  // 'invalid': 링크 만료·무효 / 'done': 변경 완료
  const [phase, setPhase]       = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      // 1. 재설정 메일 링크의 URL 해시에서 토큰을 직접 파싱해 세션 생성
      const hash = window.location.hash.slice(1)
      if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash)
        const accessToken  = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          })
          // 토큰이 URL에 남지 않도록 해시 제거
          window.history.replaceState(null, '', window.location.pathname)
          if (cancelled) return
          setPhase(error ? 'invalid' : 'ready')
          return
        }
      }

      // 2. 해시가 없으면 기존 세션 확인 (로그인 상태에서 직접 방문한 경우)
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      setPhase(session ? 'ready' : 'invalid')
    }

    init()
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      if (error.message.includes('should be different')) {
        setError('기존 비밀번호와 다른 비밀번호를 사용해주세요.')
      } else if (error.message.includes('weak') || error.message.includes('at least')) {
        setError('더 강력한 비밀번호를 사용해주세요.')
      } else {
        setError(error.message)
      }
      return
    }
    // 변경 완료 → 세션 종료 후 재로그인 유도
    await supabase.auth.signOut()
    setPhase('done')
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
        .spinner-dark {
          width: 18px; height: 18px;
          border: 2px solid #242a35;
          border-top-color: #4db6ac;
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
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e0e6ed', letterSpacing: '-0.01em' }}>비밀번호 재설정</h2>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>새로 사용할 비밀번호를 입력해주세요.</p>
            </div>

            <div style={{ height: 1, background: '#242a35', margin: '20px 0 0' }} />

            {/* ── 세션 확인 중 ── */}
            {phase === 'checking' && (
              <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <span className="spinner-dark" />
                <span style={{ fontSize: 12, color: '#64748b' }}>재설정 링크 확인 중...</span>
              </div>
            )}

            {/* ── 무효/만료 링크 ── */}
            {phase === 'invalid' && (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e6ed', marginBottom: 6 }}>링크가 유효하지 않습니다</div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                    재설정 링크가 만료됐거나 이미 사용됐습니다.<br/>비밀번호 찾기를 다시 시도해주세요.
                  </div>
                </div>
                <Link href="/forgot-password" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', padding: '11px', boxSizing: 'border-box',
                  background: '#4db6ac', borderRadius: 3,
                  fontSize: 13, fontWeight: 700, color: '#07080a',
                  textDecoration: 'none',
                }}>
                  비밀번호 찾기로 이동
                </Link>
              </div>
            )}

            {/* ── 새 비밀번호 입력 ── */}
            {phase === 'ready' && (
              <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                    새 비밀번호
                  </label>
                  <input
                    type="password"
                    className="field-input"
                    placeholder="8자 이상"
                    value={password}
                    onChange={e => { setPassword(e.target.value.replace(/\s/g, '')); setError('') }}
                    autoComplete="new-password"
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                    새 비밀번호 확인
                  </label>
                  <input
                    type="password"
                    className="field-input"
                    placeholder="다시 입력"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value.replace(/\s/g, '')); setError('') }}
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 3 }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? (<><span className="spinner" />변경 중...</>) : '비밀번호 변경'}
                </button>
              </form>
            )}

            {/* ── 완료 ── */}
            {phase === 'done' && (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(77,182,172,0.12)', border: '2px solid rgba(77,182,172,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e6ed', marginBottom: 6 }}>비밀번호가 변경됐습니다</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>새 비밀번호로 다시 로그인해주세요.</div>
                </div>
                <button onClick={() => router.push('/login')} className="btn-submit">
                  로그인하러 가기
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
