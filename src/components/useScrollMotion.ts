'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * 하이엔드 웹사이트에서 쓰는 스크롤 연출 3종 세트.
 * 스크롤을 가로채지 않으므로(스냅/휠 하이재킹 없음) 위·아래 어느 방향이든 자유롭게 움직임.
 *
 *  1) useSmoothScroll  — Lenis 관성 스크롤(휠·트랙패드·터치 모두 부드럽게)
 *  2) useReveal        — 요소가 뷰포트에 들어오면 페이드+상승 리빌(1회)
 *  3) useSectionScroll — 특정 섹션의 스크롤 진행도(0~1) + 화면 안 여부
 */

/** Lenis 관성 스크롤을 페이지 전체에 적용. prefers-reduced-motion 이면 건너뜀. */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null
    let raf = 0
    let cancelled = false

    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return
      lenis = new Lenis({
        duration: 1.05,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      })
      const loop = (time: number) => {
        lenis?.raf(time)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      lenis?.destroy()
    }
  }, [enabled])
}

/**
 * `.reveal` 클래스가 붙은 자손 요소들을 뷰포트 진입 시 `.is-in` 으로 전환.
 * 스태거는 CSS 쪽에서 --d(지연) 변수로 처리.
 */
export function useReveal(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    if (!els.length) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('is-in'))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [enabled])
}

/**
 * 섹션이 화면을 지나가는 동안의 진행도(0~1)와 화면 안 여부를 반환.
 * scroll 이벤트는 rAF 로 코얼레싱해서 프레임당 한 번만 계산.
 */
export function useSectionScroll<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null)
  const [progress, setProgress] = useState(0)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    let raf = 0
    let queued = false
    const measure = () => {
      queued = false
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      // 섹션 상단이 화면 하단에 닿는 순간 0, 섹션 하단이 화면 상단을 지나면 1
      const total = r.height + vh
      const p = (vh - r.top) / total
      setProgress(Math.min(1, Math.max(0, p)))
      setInView(r.bottom > 0 && r.top < vh)
    }
    const onScroll = () => {
      if (queued) return
      queued = true
      raf = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [enabled])

  return { ref, progress, inView }
}
