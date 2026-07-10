import type { NextRequest } from 'next/server'

const HEADER = 'x-internal-secret'

/**
 * 서버-서버 내부 호출 인증.
 * add-node / delete-node 가 rank-check 를 호출할 때 이 헤더로 신원을 증명한다.
 * 시크릿은 서버 환경변수(INTERNAL_API_SECRET)라 외부에 노출되지 않는다.
 */
export function isInternalCall(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false                      // 미설정 시 내부 호출로 인정하지 않음(안전측)
  const got = req.headers.get(HEADER)
  return !!got && got === secret
}

/** 내부 호출용 헤더 (fetch 에 그대로 spread) */
export function internalHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET
  return secret ? { [HEADER]: secret } : {}
}
