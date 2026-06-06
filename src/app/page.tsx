'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'

export default function GatewayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handleMouse)

    const particles = Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      speed: 0.2 + Math.random() * 0.5,
      size: Math.random() * 1.5 + 0.3,
      opacity: Math.random() * 0.6 + 0.1,
    }))

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      ctx.fillStyle = '#0f1115'
      ctx.fillRect(0, 0, w, h)

      const mx = mouseRef.current.x || w / 2
      const my = mouseRef.current.y || h / 2
      const px = (mx / w - 0.5) * 30
      const py = (my / h - 0.5) * 30

      const grad = ctx.createRadialGradient(w / 2 + px, h / 2 + py, 0, w / 2 + px, h / 2 + py, w * 0.4)
      grad.addColorStop(0, 'rgba(77,182,172,0.06)')
      grad.addColorStop(0.5, 'rgba(157,80,187,0.04)')
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // Perspective grid
      ctx.strokeStyle = 'rgba(36,42,53,0.4)'
      ctx.lineWidth = 0.5
      const horizon = h * 0.6
      const vanishX = w / 2
      const cols = 14
      for (let i = 0; i <= cols; i++) {
        const tx = (w / cols) * i
        ctx.beginPath()
        ctx.moveTo(vanishX, horizon)
        ctx.lineTo(tx, h)
        ctx.stroke()
      }
      for (let j = 1; j <= 8; j++) {
        const t = j / 8
        const y = horizon + (h - horizon) * t
        const spread = w * 0.5 * t
        ctx.beginPath()
        ctx.moveTo(vanishX - spread, y)
        ctx.lineTo(vanishX + spread, y)
        ctx.stroke()
      }

      // Stars
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(224,230,237,${p.opacity})`
        ctx.fill()
        p.y -= p.speed
        if (p.y < 0) {
          p.y = h
          p.x = Math.random() * w
        }
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouse)
    }
  }, [])

  return (
    <main className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-fadeIn">
        <div className="flex flex-col items-center gap-4">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <rect x="4" y="11" width="44" height="8" rx="2" stroke="#4db6ac" strokeWidth="1.8" />
            <rect x="4" y="23" width="44" height="8" rx="2" stroke="#4db6ac" strokeWidth="1.8" opacity="0.6" />
            <rect x="4" y="35" width="44" height="8" rx="2" stroke="#4db6ac" strokeWidth="1.8" opacity="0.3" />
          </svg>
          <h1 className="font-mono text-4xl tracking-[0.35em] uppercase" style={{ color: 'var(--accent-blue)' }}>
            Aetheris
          </h1>
          <p className="font-mono text-xs tracking-widest text-center" style={{ color: 'var(--text-tertiary)' }}>
            당신의 네트워크 운명을 설계하세요
          </p>
          <p className="font-mono text-[11px] text-center max-w-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
            MT5 카피트레이딩 기반 · 월 평균 10% · Profit Sharing 40%
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link
            href="/dashboard"
            className="font-mono text-sm tracking-[0.2em] uppercase px-10 py-3 rounded transition-all duration-300 hover:shadow-lg"
            style={{
              border: '1px solid var(--accent-blue)',
              color: 'var(--accent-blue)',
              background: 'rgba(77,182,172,0.07)',
            }}
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="font-mono text-xs tracking-wider transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            계정이 없으신가요? 노드 초기화 →
          </Link>
        </div>
      </div>

      <div
        className="absolute bottom-6 left-0 right-0 flex justify-center font-mono text-[10px] tracking-widest"
        style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}
      >
        Aetheris OS // Gateway Node
      </div>
    </main>
  )
}
