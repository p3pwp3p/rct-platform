'use client'
import useSWR, { type SWRConfiguration } from 'swr'
import { supabase } from './supabase'

// 만료·무효 세션 처리 중복 방지 플래그
let redirecting = false

/** 세션이 유효하지 않을 때: 정리 후 로그인으로. (중복 호출 안전) */
async function handleUnauthed() {
  if (redirecting) return
  redirecting = true
  try { await supabase.auth.signOut() } catch { /* 무시 */ }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

/** Supabase 세션 토큰을 붙여 API 라우트를 호출하는 SWR fetcher */
export async function authedFetcher(url: string) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
  })
  const json = await res.json().catch(() => ({}))
  // 만료·무효 토큰 → 조용히 401 로 비어 보이지 않도록, 세션 정리 후 로그인으로
  if (res.status === 401) {
    await handleUnauthed()
    throw new Error('세션이 만료되어 다시 로그인해야 합니다.')
  }
  if (!res.ok) throw new Error(json?.error ?? `요청 실패 (${res.status})`)
  return json
}

/**
 * 인증이 필요한 API 라우트용 SWR 훅.
 * key 가 null 이면 요청하지 않는다(조건부 페칭).
 */
export function useApi<T = unknown>(key: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(key, authedFetcher, config)
}
