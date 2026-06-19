'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ConfirmPage() {
  // 'checking': 토큰 확인 중 / 'done': 인증 완료 / 'invalid': 링크 만료·무효
  const [phase, setPhase] = useState<'checking' | 'done' | 'invalid'>('checking')

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      // 1. 인증 메일 링크의 URL 해시에서 토큰을 파싱해 세션 생성
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
          setPhase(error ? 'invalid' : 'done')
          return
        }
      }

      // 2. 해시에 에러가 담겨오는 경우 (만료 등)
      if (hash.includes('error')) {
        if (!cancelled) setPhase('invalid')
        return
      }

      // 3. 해시가 없으면 기존 세션 확인 (이미 인증을 마친 뒤 재방문)
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      setPhase(session ? 'done' : 'invalid')
    }

    init()
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
        .btn-submit {
          width: 100%; box-sizing: border-box;
          background: #4db6ac; color: #07080a; border: none;
          padding: 13px; border-radius: 3px;
          font-family: var(--font-main); font-size: 13px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer;
          transition: all 0.25s; display: flex; align-items: center; justify-content: center; gap: 8px;
          text-decoration: none;
        }
        .btn-submit:hover { background: #5ec8be; box-shadow: 0 0 20px rgba(77,182,172,0.25); transform: translateY(-1px); }
        .spinner-dark {
          width: 18px; height: 18px;
          border: 2px solid #242a35; border-top-color: #4db6ac;
          border-radius: 50%; animation: spin 0.7s linear infinite;
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

            {/* ── 확인 중 ── */}
            {phase === 'checking' && (
              <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <span className="spinner-dark" />
                <span style={{ fontSize: 12, color: '#64748b' }}>이메일 인증 확인 중...</span>
              </div>
            )}

            {/* ── 인증 완료 ── */}
            {phase === 'done' && (
              <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(77,182,172,0.12)', border: '2px solid rgba(77,182,172,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e6ed', marginBottom: 8 }}>이메일 인증이 완료됐습니다</div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                    계정이 정상적으로 활성화됐습니다.<br/>대시보드에서 노드를 등록하세요.
                  </div>
                </div>
                <Link href="/dashboard" className="btn-submit">대시보드로 이동</Link>
              </div>
            )}

            {/* ── 무효/만료 ── */}
            {phase === 'invalid' && (
              <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e0e6ed', marginBottom: 8 }}>인증 링크가 유효하지 않습니다</div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                    링크가 만료됐거나 이미 사용됐습니다.<br/>로그인하거나 다시 가입을 진행해주세요.
                  </div>
                </div>
                <Link href="/login" className="btn-submit">로그인으로 이동</Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
