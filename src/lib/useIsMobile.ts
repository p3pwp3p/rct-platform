'use client'
import { useEffect, useState } from 'react'

/**
 * 뷰포트가 모바일(기본 ≤768px)인지 여부.
 * 모바일에서 테이블 대신 카드로 렌더하는 등 레이아웃 분기에 사용.
 */
export function useIsMobile(maxWidth = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [maxWidth])
  return isMobile
}
