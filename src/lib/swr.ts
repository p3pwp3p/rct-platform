'use client'
import useSWR, { type SWRConfiguration } from 'swr'
import { supabase } from './supabase'

/** Supabase 세션 토큰을 붙여 API 라우트를 호출하는 SWR fetcher */
export async function authedFetcher(url: string) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
  })
  const json = await res.json().catch(() => ({}))
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
