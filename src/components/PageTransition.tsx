'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 경로 변경마다 애니메이션 재실행
    el.style.animation = 'none'
    // reflow 강제 트리거
    void el.offsetHeight
    el.style.animation = 'pageFade 0.18s ease-out both'
  }, [pathname])

  return (
    <>
      <style>{`
        @keyframes pageFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
      <div
        ref={ref}
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'pageFade 0.18s ease-out both',
        }}
      >
        {children}
      </div>
    </>
  )
}
