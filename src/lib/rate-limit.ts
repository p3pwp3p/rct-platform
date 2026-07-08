import { createClient } from '@supabase/supabase-js'

// 레이트리밋 전용 service-role 클라이언트 (모듈 싱글턴)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * 레이트리밋 검사. key 에 대해 window(초) 동안 max 회까지 허용.
 * @returns true = 허용 / false = 한도 초과
 *
 * 리미터 자체가 실패하면 fail-open(true) — 정상 사용자를 막지 않는다.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    })
    if (error) { console.error('[rateLimit]', error.message); return true }
    return data === true
  } catch (e) {
    console.error('[rateLimit]', e)
    return true
  }
}

/** 요청에서 클라이언트 IP 추출 (Vercel x-forwarded-for) */
export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0].trim())
    || req.headers.get('x-real-ip')
    || 'unknown'
}

/** 429 응답 JSON */
export const tooMany = { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' }
