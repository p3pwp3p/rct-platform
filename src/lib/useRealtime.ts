'use client'
import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

/**
 * Supabase realtime — 특정 테이블의 변경(INSERT/UPDATE/DELETE)을 구독해 콜백 실행.
 * 보통 콜백에서 SWR mutate() 를 호출해 최신 데이터를 재검증한다(정합성 유지).
 *
 * RLS 가 적용되므로, 사용자가 SELECT 가능한 행의 변경만 수신한다.
 * (해당 테이블이 supabase_realtime 퍼블리케이션에 포함돼 있어야 동작)
 */
export function useRealtime(
  table: string,
  onChange: () => void,
  opts?: { schema?: string; filter?: string; enabled?: boolean },
) {
  const cbRef = useRef(onChange)
  cbRef.current = onChange
  const enabled = opts?.enabled ?? true

  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: opts?.schema ?? 'public', table, ...(opts?.filter ? { filter: opts.filter } : {}) },
        () => cbRef.current(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [table, enabled, opts?.schema, opts?.filter])
}
