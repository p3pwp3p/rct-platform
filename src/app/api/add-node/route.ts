/**
 * POST /api/add-node
 *
 * 로그인된 유저가 자신의 소유로 새 노드(프로필)를 추가.
 * - Auth 헤더로 현재 유저 확인 → owner_id 설정
 * - Service-role로 insert → DB 트리거가 node_id / ct_id / referral_code 채움
 * - 후원인/추천인은 코드로 검증
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { name, sponsorCode, referrerCode, leg, mt5AccountId, accessToken } =
      await req.json()

    if (!name || !sponsorCode || !referrerCode || !leg || !accessToken) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    // ── 1. 현재 유저 확인 (클라이언트에서 받은 access_token 검증) ──
    const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken)
    if (userErr || !userData.user) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 })
    }
    const ownerId = userData.user.id

    // ── 2. 후원인 검증 ──────────────────────────────────────────────
    const { data: sponsorRows, error: sErr } = await adminClient.rpc('validate_referral_code', {
      code: sponsorCode.trim().toUpperCase(),
    })
    if (sErr) throw new Error(sErr.message)
    const sponsor = (sponsorRows ?? [])[0]
    if (!sponsor) return NextResponse.json({ error: '후원인 코드가 존재하지 않습니다.' }, { status: 400 })
    if (leg === 'LEFT'  && sponsor.left_taken)  return NextResponse.json({ error: '후원인의 Left 레그가 이미 점유됐습니다.' }, { status: 400 })
    if (leg === 'RIGHT' && sponsor.right_taken) return NextResponse.json({ error: '후원인의 Right 레그가 이미 점유됐습니다.' }, { status: 400 })

    // ── 3. 추천인 검증 ──────────────────────────────────────────────
    const { data: referrerRows, error: rErr } = await adminClient.rpc('validate_referral_code', {
      code: referrerCode.trim().toUpperCase(),
    })
    if (rErr) throw new Error(rErr.message)
    const referrer = (referrerRows ?? [])[0]
    if (!referrer) return NextResponse.json({ error: '추천인 코드가 존재하지 않습니다.' }, { status: 400 })

    // ── 4. 프로필 생성 (트리거가 node_id / ct_id / referral_code 채움) ──
    const { data: inserted, error: profileErr } = await adminClient
      .from('profiles')
      .insert({
        name:           name.trim(),
        rank:           'R0',
        parent_id:      sponsor.profile_id,
        leg_position:   leg,
        referrer_id:    referrer.profile_id,
        owner_id:       ownerId,
        mt5_account_id: mt5AccountId?.trim() || null,
        sales:          0,
        // node_id, ct_id, referral_code → DB 트리거 자동 생성
      })
      .select('id, node_id, ct_id')
      .single()

    if (profileErr) throw new Error(profileErr.message)

    // ── 5. 후원인 + 추천인 체인 직급 재검사 ─────────────────────────
    // 두 체인 모두 새 노드 추가로 조건이 변할 수 있음
    const rankCheckUrl = new URL('/api/rank-check', req.url).toString()
    const rankCheckIds = new Set([sponsor.profile_id, referrer.profile_id])

    await Promise.allSettled(
      [...rankCheckIds].map(profileId =>
        fetch(rankCheckUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ profileId }),
        })
      )
    )

    return NextResponse.json({ success: true, profile: inserted })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '서버 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
