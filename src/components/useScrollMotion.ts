'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * 랜딩 스크롤 연출 모음.
 *
 *  1) useSmoothScroll  — Lenis 관성 스크롤(휠·트랙패드·터치)
 *  2) useReveal        — 뷰포트 진입 시 페이드+상승 리빌(1회)
 *  3) useSectionScroll — 특정 섹션의 스크롤 진행도(0~1) + 화면 안 여부
 *  4) useScrubProgress — [data-scrub] 섹션의 스크롤 진행도를 CSS 변수 --p 로 전달
 *  5) useSectionPager  — 휠/스와이프 한 칸 = 다음·이전 섹션으로 부드럽게 스크럽
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
 *
 * `mode`:
 *  - 'through'(기본) 섹션 상단이 화면 하단에 닿을 때 0, 하단이 화면 상단을 지나면 1
 *  - 'pinned'  sticky 로 고정된 구간만 0~1 로 정규화. 내부 콘텐츠가 화면에 붙어 있는
 *              동안의 진행도라, 시네마틱 스크럽(단계별 전환)에는 이쪽이어야 0~1 을 다 쓴다.
 */
export function useSectionScroll<T extends HTMLElement>(
  enabled = true,
  mode: 'through' | 'pinned' = 'through',
) {
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
      const p = mode === 'pinned'
        ? -r.top / Math.max(r.height - vh, 1)
        : (vh - r.top) / (r.height + vh)
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
  }, [enabled, mode])

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

const PAGE_MS = 900

/**
 * 휠(또는 터치 스와이프) 한 번 = 다음/이전 `selector` 섹션으로 한 칸, 부드럽게 이동.
 *
 * 스크롤을 통째로 잠그지 않는다 — `selector` 로 지정한 구간(풀스크린 히어로 2개)
 * 안에서만 동작하고, 마지막 섹션에서 더 내리면 손을 떼 그 아래 콘텐츠는
 * 평소대로 자유 스크롤된다. 각 섹션이 220vh 스크럽 구간이라 휠 한 칸으로는
 * 조금씩만 움직여 뻑뻑하게 느껴지는 문제를, 섹션 경계로 한 번에 스크럽하는
 * 방식으로 해결— Lenis 트윈이 지나가는 동안 스크럽 진행도(--p)도 함께
 * 자연스럽게 흐르므로 "슉 넘어가는" 줌 전환처럼 보인다.
 */
export function useSectionPager(selector: string, enabled = true) {
  useEffect(() => {
    // 페이징 자체(휠 한 칸=다음 섹션)는 핵심 내비게이션이라 reduced-motion 에도 끄지 않는다.
    // 대신 reduced-motion 이면 트윈 없이 즉시 이동해 "많이 움직이는" 느낌만 없앤다.
    if (!enabled) return
    if (!window.matchMedia('(min-width: 769px)').matches) return

    let locked = false
    let unlockTimer = 0
    let raf = 0

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

    // Lenis 유무·초기화 타이밍에 기대지 않는 자체 rAF 트윈 — 항상 확실하게 동작.
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
    const tweenTo = (y: number, ms: number) => {
      cancelAnimationFrame(raf)
      const startY = window.scrollY
      const dist = y - startY
      if (Math.abs(dist) < 1 || ms <= 0) { window.scrollTo(0, y); return }
      const t0 = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms)
        window.scrollTo(0, startY + dist * easeOutCubic(t))
        if (t < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }

    const goto = (i: number) => {
      const els = sections()
      const el = els[i]
      if (!el) return
      locked = true
      const y = el.offsetTop
      const lenis = getLenis()
      if (lenis) {
        // Lenis 가 떠 있으면 그쪽 스크롤 상태와 어긋나지 않도록 우선 사용
        lenis.scrollTo(y, {
          duration: prefersReduced() ? 0 : PAGE_MS / 1000,
          easing: easeOutCubic,
          lock: true,
          force: true,
        })
      } else {
        tweenTo(y, prefersReduced() ? 0 : PAGE_MS)
      }
      window.clearTimeout(unlockTimer)
      unlockTimer = window.setTimeout(() => { locked = false }, (prefersReduced() ? 0 : PAGE_MS) + 60)
    }

    const handleIntent = (dir: 1 | -1, e: Event) => {
      const els = sections()
      if (!els.length) return
      if (window.scrollY >= zoneEnd() - 10) return // 구간 밖(아래 콘텐츠)이면 관여하지 않음

      const idx = currentIndex()
      if (dir > 0 && idx >= els.length - 1) return
      if (dir < 0 && idx <= 0 && window.scrollY <= 2) return

      e.preventDefault()
      e.stopImmediatePropagation()
      if (locked) return

      const offFromTop = window.scrollY - els[idx].offsetTop
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

    const opts = { capture: true, passive: false } as const
    window.addEventListener('wheel', onWheel, opts)
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    window.addEventListener('touchmove', onTouchMove, opts)

    return () => {
      window.clearTimeout(unlockTimer)
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', onWheel, opts)
      window.removeEventListener('touchstart', onTouchStart, { capture: true })
      window.removeEventListener('touchmove', onTouchMove, opts)
    }
  }, [selector, enabled])
}
