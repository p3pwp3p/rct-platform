/**
 * POST /api/vantage-ack
 *
 * 로그인된 유저의 Vantage 가입 안내 모달 확인을 기록 (계정당 1회).
 * - Auth 토큰으로 유저 확인
 * - service-role로 해당 유저가 소유한 모든 프로필(id = uid OR owner_id = uid)에
 *   vantage_ack = true 설정 → RLS와 무관하게 안정적으로 기록
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { accessToken } = await req.json()
    if (!accessToken) {
      return NextResponse.json({ error: '인증 토큰 누락' }, { status: 400 })
    }

    const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken)
    if (userErr || !userData.user) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 })
    }
    const uid = userData.user.id

    const { error } = await adminClient
      .from('profiles')
      .update({ vantage_ack: true })
      .or(`id.eq.${uid},owner_id.eq.${uid}`)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '저장 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
