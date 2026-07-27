'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * 랜딩 스크롤 연출 모음.
 *
 *  1) useSmoothScroll  — Lenis 관성 스크롤(휠·트랙패드·터치)
 *  2) useReveal        — 뷰포트 진입 시 페이드+상승 리빌(1회)
 *  3) useSectionScroll — 특정 섹션의 스크롤 진행도(0~1) + 화면 안 여부
 *  4) useSectionPager  — 휠 한 번 = 다음/이전 풀스크린 섹션으로 이동(전환 연출 포함)
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

const PAGE_MS = 1000

/**
 * 휠(또는 터치 스와이프) 한 번 = 다음/이전 풀스크린 섹션으로 한 칸 이동.
 *
 * 스크롤을 통째로 잠그지 않는 게 핵심 — 페이저는 `selector` 로 지정한
 * 풀스크린 섹션 구간에서만 동작하고, 마지막 섹션에서 아래로 내리면 손을 떼
 * 그 아래 일반 콘텐츠는 평소대로 자유롭게 스크롤된다(이전 스냅 방식이
 * 위·아래 모두 답답했던 원인을 피함). 키보드 스크롤도 가로채지 않는다.
 *
 * 이동 중에는 <html> 에 `lp-paging` 이 붙어 CSS 전환 연출이 재생된다.
 */
export function useSectionPager(selector: string, enabled = true) {
  useEffect(() => {
    if (!enabled || prefersReduced()) return
    // 모바일에선 페이징이 오히려 답답해 비활성(자유 스크롤)
    if (!window.matchMedia('(min-width: 769px)').matches) return

    let locked = false
    let unlockTimer = 0

    const sections = () => Array.from(document.querySelectorAll<HTMLElement>(selector))
    const zoneEnd = () => {
      const els = sections()
      const last = els[els.length - 1]
      return last ? last.offsetTop + last.offsetHeight : 0
    }
    const currentIndex = () => {
      const els = sections()
      const probe = window.scrollY + window.innerHeight * 0.5
      let idx = 0
      els.forEach((el, i) => { if (probe >= el.offsetTop) idx = i })
      return idx
    }

    const goto = (i: number) => {
      const els = sections()
      const el = els[i]
      if (!el) return
      locked = true
      document.documentElement.classList.add('lp-paging')
      const y = el.offsetTop
      const lenis = getLenis()
      if (lenis) {
        lenis.scrollTo(y, {
          duration: PAGE_MS / 1000,
          easing: (t: number) => 1 - Math.pow(1 - t, 3),
          lock: true,
          force: true,
        })
      } else {
        window.scrollTo({ top: y, behavior: 'smooth' })
      }
      window.clearTimeout(unlockTimer)
      unlockTimer = window.setTimeout(() => {
        locked = false
        document.documentElement.classList.remove('lp-paging')
      }, PAGE_MS + 60)
    }

    const handleIntent = (dir: 1 | -1, e: Event) => {
      const els = sections()
      if (!els.length) return
      // 페이저 구간 밖(아래 콘텐츠)이면 관여하지 않음
      if (window.scrollY >= zoneEnd() - 10) return

      const idx = currentIndex()
      if (dir > 0 && idx >= els.length - 1) return   // 마지막 스크린 → 아래 콘텐츠로 놓아줌
      if (dir < 0 && idx <= 0 && window.scrollY <= 2) return // 최상단 → 더 올릴 곳 없음

      e.preventDefault()
      e.stopImmediatePropagation()
      if (locked) return

      const offFromTop = window.scrollY - els[idx].offsetTop
      // 위로 올릴 때 현재 섹션에 딱 맞춰져 있지 않으면 먼저 현재 섹션으로 정렬
      if (dir < 0 && offFromTop > 12) goto(idx)
      else goto(idx + dir)
    }

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 2) return
      handleIntent(e.deltaY > 0 ? 1 : -1, e)
    }

    let touchY = 0
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY }
    const onTouchMove = (e: TouchEvent) => {
      const dy = touchY - e.touches[0].clientY
      if (Math.abs(dy) < 40) return
      handleIntent(dy > 0 ? 1 : -1, e)
    }

    // capture 단계로 먼저 잡아야 Lenis 의 휠 처리보다 앞설 수 있음
    const opts = { capture: true, passive: false } as const
    window.addEventListener('wheel', onWheel, opts)
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    window.addEventListener('touchmove', onTouchMove, opts)

    return () => {
      window.clearTimeout(unlockTimer)
      document.documentElement.classList.remove('lp-paging')
      window.removeEventListener('wheel', onWheel, opts)
      window.removeEventListener('touchstart', onTouchStart, { capture: true })
      window.removeEventListener('touchmove', onTouchMove, opts)
    }
  }, [selector, enabled])
}
