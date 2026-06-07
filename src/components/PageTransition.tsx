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
    el.style.animation = 'spaceEnter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both'
  }, [pathname])

  return (
    <>
      <style>{`
        @keyframes spaceEnter {
          0% {
            opacity: 0;
            transform: translateY(6px) scale(0.995);
            filter: blur(4px) brightness(0.6);
          }
          40% {
            filter: blur(1px) brightness(0.9);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px) brightness(1);
          }
        }
      `}</style>
      <div
        ref={ref}
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'spaceEnter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {children}
      </div>
    </>
  )
}
