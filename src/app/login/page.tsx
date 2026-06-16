'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nebulaRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let particles: { x: number; y: number; size: number; speed: number; opacity: number }[] = []
    let width = 0, height = 0

    const init = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
      particles = Array.from({ length: 180 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.2,
        speed: Math.random() * 0.15 + 0.04,
        opacity: Math.random() * 0.4 + 0.08,
      }))
    }
    init()
    window.addEventListener('resize', init)

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#07080a'
      ctx.fillRect(0, 0, width, height)
      for (const p of particles) {
        p.y -= p.speed
        if (p.y < 0) { p.y = height; p.x = Math.random() * width }
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(224,230,237,${p.opacity})`
        ctx.fill()
      }
      animId = requestAnimationFrame(draw)
    }
    draw()

    const handleMouse = (e: MouseEvent) => {
      if (!nebulaRef.current) return
      const mx = (e.clientX - width / 2) * 0.008
      const my = (e.clientY - height / 2) * 0.008
      nebulaRef.current.style.transform = `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px))`
    }
    window.addEventListener('mousemove', handleMouse)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', init)
      window.removeEventListener('mousemove', handleMouse)
    }
  }, [])

  // 아이디(@없음) → 이메일 변환 테이블
  const USERNAME_MAP: Record<string, string> = {
    'rctplatformadmin': 'rctplatformadmin@gmail.com',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('이메일 또는 아이디와 비밀번호를 입력해주세요.')
      return
    }

    // 아이디 입력 시 이메일로 변환
    const loginEmail = email.includes('@')
      ? email
      : (USERNAME_MAP[email.trim().toLowerCase()] ?? null)

    if (!loginEmail) {
      setError('존재하지 않는 아이디입니다.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    setLoading(false)

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('아이디/이메일 또는 비밀번호가 올바르지 않습니다.')
      } else if (error.message.includes('Email not confirmed')) {
        setError('이메일 인증이 필요합니다. 받은 편지함을 확인해주세요.')
      } else {
        setError(error.message)
      }
      return
    }

    // 관리자 여부 확인 → 라우팅 분기
    const role = data.user?.user_metadata?.role
    if (role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .grid-layer {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(to right, rgba(148,163,184,0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(148,163,184,0.02) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
          z-index: 3;
          transform: perspective(1000px) rotateX(60deg) translateY(100px);
          opacity: 0.4;
        }
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
          width: 14px;
          height: 14px;
          border: 2px solid rgba(7,8,10,0.3);
          border-top-color: #07080a;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: #242a35;
        }
      `}</style>

      <main style={{ backgroundColor: '#07080a', height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} />

        <div ref={nebulaRef} style={{ position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle at center, rgba(77,182,172,0.05) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 2, pointerEvents: 'none' }} />

        <div className="grid-layer" />

        {/* Login card */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            maxWidth: 380,
            animation: 'fadeInUp 1.6s ease-out both',
            padding: '0 16px',
          }}
        >
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

            {/* Card header */}
            <div style={{ padding: '20px 24px 0' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e0e6ed', letterSpacing: '-0.01em' }}>로그인</h2>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>계정에 접속하여 네트워크를 관리하세요.</p>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#242a35', margin: '20px 0 0' }} />

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                  이메일 / 아이디
                </label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="이메일 또는 아이디"
                  value={email}
                  onChange={e => setEmail(e.target.value.replace(/\s/g, ''))}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  autoComplete="email"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                    비밀번호
                  </label>
                  <Link href="/forgot-password" style={{ fontSize: 11, color: '#4db6ac', opacity: 0.7, textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                  >
                    비밀번호 찾기
                  </Link>
                </div>
                <input
                  type="password"
                  className="field-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value.replace(/\s/g, ''))}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  autoComplete="current-password"
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 3 }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn-submit" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    접속 중...
                  </>
                ) : '로그인'}
              </button>
            </form>

            {/* Footer */}
            <div style={{ padding: '0 24px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="divider-line" />
              <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>계정이 없으신가요?</span>
              <div className="divider-line" />
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <Link
                href="/signup"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', padding: '11px',
                  border: '1px solid #323a48', borderRadius: 3,
                  fontSize: 13, fontWeight: 500, color: '#94a3b8',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#4db6ac'; e.currentTarget.style.color = '#4db6ac' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#323a48'; e.currentTarget.style.color = '#94a3b8' }}
              >
                회원가입
              </Link>
            </div>
          </div>

          {/* Status */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#64748b', opacity: 0.4 }}>
              RCT OS // Gateway Node
            </span>
          </div>
        </div>
      </main>
    </>
  )
}
