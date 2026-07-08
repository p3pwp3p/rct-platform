'use client'
import { useEffect, type RefObject } from 'react'

/**
 * 모달 접근성: 포커스 트랩(Tab 순환) + Escape 닫기 + 열기 전 포커스 복원.
 * 모달 컨테이너에 ref 를 걸고 호출한다. 컨테이너에는 role="dialog" aria-modal="true" 권장.
 */
export function useModalA11y(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prevFocused = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(el.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter(n => n.offsetParent !== null)

    // 첫 요소로 포커스 이동
    const list0 = focusables()
    ;(list0[0] ?? el).focus?.()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) { e.preventDefault(); return }
      const first = list[0], last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      prevFocused?.focus?.()
    }
  }, [ref, onClose])
}
