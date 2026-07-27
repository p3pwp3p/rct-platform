'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * 랜딩 스크롤 연출 모음.
 *
 *  1) useSmoothScroll  — Lenis 관성 스크롤(휠·트랙패드·터치)
 *  2) useReveal        — 뷰포트 진입 시 페이드+상승 리빌(1회)
 *  3) useSectionScroll — 특정 섹션의 스크롤 진행도(0~1) + 화면 안 여부
 *  4) useScrubProgress — [data-scrub] 섹션의 스크롤 진행도를 CSS 변수 --p 로 전달
 */

type LenisLike = {
  raf: (t: number) => void
  destroy: () => void
  scrollTo: (t: number, o?: Record<string, unknown>) => void
}

// 페이저가 Lenis 의 트윈을 재사용할 수 있도록 인스턴스를 모듈 스코프에 보관
let lenisInstance: LenisLike | null = null
export const getLenis = () => lenisInstance

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Lenis 관성 스크롤을 페이지 전체에 적용. prefers-reduced-motion 이면 건너뜀. */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || prefersReduced()) return

    let raf = 0
    let cancelled = false

    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return
      const l = new Lenis({
        duration: 1.05,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      }) as unknown as LenisLike
      lenisInstance = l
      const loop = (time: number) => {
        l.raf(time)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      lenisInstance?.destroy()
      lenisInstance = null
    }
  }, [enabled])
}

/**
 * `.reveal` 클래스가 붙은 요소를 뷰포트 진입 시 `.is-in` 으로 전환.
 * 스태거는 CSS 쪽 --d(지연) 변수로 처리.
 */
export function useReveal(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    if (!els.length) return

    if (prefersReduced()) {
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
 * 섹션이 화면을 지나가는 동안의 진행도(0~1)와 화면 안 여부.
 * scroll 이벤트는 rAF 로 코얼레싱해 프레임당 한 번만 계산.
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
      const total = r.height + vh
      setProgress(Math.min(1, Math.max(0, (vh - r.top) / total)))
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


/**
 * `[data-scrub]` 가 붙은 섹션마다 스크롤 진행도를 CSS 변수 `--p`(0~1)로 흘려보낸다.
 * 실제 움직임(확대·이동·페이드)은 전부 CSS 쪽 calc() 에서 --p 를 읽어 처리하므로
 * JS 는 값만 갱신하고 레이아웃엔 손대지 않는다(리플로우 없음).
 *
 * 진행도 기준: 섹션 상단이 화면 하단에 닿는 순간 0, 섹션 하단이 화면 상단을 지나면 1.
 * `data-scrub="in"` 이면 섹션이 화면에 들어와 있는 구간만 0~1 로 정규화한다.
 */
export function useScrubProgress(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-scrub]'))
    if (!els.length) return

    if (prefersReduced()) {
      els.forEach((el) => el.style.setProperty('--p', '0'))
      return
    }

    let raf = 0
    let queued = false
    const measure = () => {
      queued = false
      const vh = window.innerHeight
      for (const el of els) {
        const r = el.getBoundingClientRect()
        let p: number
        if (el.dataset.scrub === 'in') {
          // 섹션이 화면을 채우고 있는 동안만 0~1 (상단 정렬 기준)
          p = -r.top / Math.max(r.height - vh, 1)
        } else {
          p = (vh - r.top) / (r.height + vh)
        }
        el.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(4))
      }
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
}
