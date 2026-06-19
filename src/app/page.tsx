'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'

export default function GatewayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nebulaRef = useRef<HTMLDivElement>(null)

  // Supabase 비밀번호 재설정 링크가 사이트 루트로 떨어지는 경우
  // (Redirect URL 허용 목록에 /reset-password 미등록 시) 토큰을 보존한 채 전달.
  // window.location 사용: supabase 클라이언트가 새로 초기화되며 해시를 처리하도록 풀 리로드.
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      window.location.replace('/reset-password' + hash)
    } else if (hash.includes('type=signup') || hash.includes('type=email')) {
      // 회원가입/이메일 인증 링크가 사이트 루트로 떨어진 경우 확인 페이지로 전달
      window.location.replace('/auth/confirm' + hash)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let particles: { x: number; y: number; size: number; speed: number; opacity: number }[] = []
    let width = 0
    let height = 0

    const initParticles = () => {
      particles = Array.from({ length: 200 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.5,
        speed: Math.random() * 0.2 + 0.05,
        opacity: Math.random() * 0.5 + 0.2,
      }))
    }

    const resize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
      initParticles()
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      for (const p of particles) {
        p.y -= p.speed
        if (p.y < 0) p.y = height
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
      const moveX = (e.clientX - width / 2) * 0.01
      const moveY = (e.clientY - height / 2) * 0.01
      nebulaRef.current.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`
    }
    window.addEventListener('mousemove', handleMouse)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouse)
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .btn-login {
          background: transparent;
          border: 1px solid #4db6ac;
          color: #4db6ac;
          padding: 14px 48px;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.2em;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border-radius: 2px;
          position: relative;
          overflow: hidden;
          text-decoration: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-login::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 120%;
          height: 120%;
          background: rgba(77,182,172,0.15);
          transform: translate(-50%, -50%) scale(0);
          transition: transform 0.4s ease;
          z-index: -1;
        }
        .btn-login:hover {
          color: #fff;
          box-shadow: 0 0 20px rgba(77,182,172,0.2);
          transform: translateY(-2px);
        }
        .btn-login:hover::before {
          transform: translate(-50%, -50%) scale(1);
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
          opacity: 0.5;
        }
      `}</style>

      <main
        style={{
          backgroundColor: '#07080a',
          color: '#e0e6ed',
          height: '100vh',
          width: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Starfield canvas */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
        />

        {/* Nebula glow */}
        <div
          ref={nebulaRef}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '100%',
            height: '100%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle at center, rgba(77,182,172,0.05) 0%, transparent 70%)',
            filter: 'blur(80px)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />

        {/* CSS Perspective grid */}
        <div className="grid-layer" />

        {/* Login UI */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 40,
            animation: 'fadeIn 2s ease-out',
          }}
        >
          {/* Brand icon */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4db6ac"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.8, filter: 'drop-shadow(0 0 15px rgba(77,182,172,0.3))' }}
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>

          {/* Title */}
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              color: 'var(--accent-blue)',
              opacity: 0.9,
              marginTop: -20,
            }}
          >
            RCT Platform
          </h1>

          {/* Login button */}
          <Link href="/login" className="btn-login">
            로그인
          </Link>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            fontSize: 10,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            opacity: 0.3,
            zIndex: 10,
            color: '#64748b',
          }}
        >
          RCT OS // Gateway Node
        </div>
      </main>
    </>
  )
}
