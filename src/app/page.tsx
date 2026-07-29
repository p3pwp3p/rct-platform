'use client'
import { useEffect } from 'react'

/**
 * 메인 도메인(rctpf.com) 첫 화면 — 항상 로그인으로 직행.
 * 마케팅 랜딩은 /afafafafaf (비공개 프리뷰 링크)에 별도로 있으며 이 라우트와 무관하다.
 */
export default function RootPage() {
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) { window.location.replace('/reset-password' + hash); return }
    if (hash.includes('type=signup') || hash.includes('type=email')) { window.location.replace('/auth/confirm' + hash); return }
    window.location.replace('/login')
  }, [])

  return null
}
