import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS, server-only
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, sponsorCode, referrerCode, leg, mt5AccountId } = await req.json()

    if (!email || !password || !name || !sponsorCode || !referrerCode || !leg) {
      return NextResponse.json({ error: '필수 항목이 누락됐습니다.' }, { status: 400 })
    }

    // ── 1. 후원인 조회 ─────────────────────────────────────────────
    const { data: sponsorRows, error: sErr } = await adminSupabase.rpc('validate_referral_code', {
      code: sponsorCode.trim().toUpperCase(),
    })
    if (sErr) throw new Error(sErr.message)
    const sponsor = (sponsorRows ?? [])[0]
    if (!sponsor) return NextResponse.json({ error: '후원인 코드가 존재하지 않습니다.' }, { status: 400 })

    if (leg === 'LEFT'  && sponsor.left_taken)  return NextResponse.json({ error: '후원인의 Left 레그가 이미 점유됐습니다.' }, { status: 400 })
    if (leg === 'RIGHT' && sponsor.right_taken) return NextResponse.json({ error: '후원인의 Right 레그가 이미 점유됐습니다.' }, { status: 400 })

    // ── 2. 추천인 조회 ─────────────────────────────────────────────
    const { data: referrerRows, error: rErr } = await adminSupabase.rpc('validate_referral_code', {
      code: referrerCode.trim().toUpperCase(),
    })
    if (rErr) throw new Error(rErr.message)
    const referrer = (referrerRows ?? [])[0]
    if (!referrer) return NextResponse.json({ error: '추천인 코드가 존재하지 않습니다.' }, { status: 400 })

    // ── 3. Auth 유저 생성 ──────────────────────────────────────────
    const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 관리자 생성이므로 즉시 확인 처리
      user_metadata: { full_name: name },
    })
    if (authErr) {
      if (authErr.message.includes('already registered') || authErr.message.includes('already been registered')) {
        return NextResponse.json({ error: '이미 가입된 이메일 주소입니다.' }, { status: 409 })
      }
      throw new Error(authErr.message)
    }
    const userId = authData.user.id

    // ── 4. 프로필 생성 (trigger가 node_id / referral_code 채움) ──
    const { error: profileErr } = await adminSupabase.from('profiles').insert({
      id:             userId,
      name:           name.trim(),
      rank:           'R0',
      parent_id:      sponsor.profile_id,
      leg_position:   leg,
      referrer_id:    referrer.profile_id,
      owner_id:       userId,
      mt5_account_id: mt5AccountId?.trim() || null,
      node_id:        '',
      referral_code:  '',
      sales:          0,
    })

    if (profileErr) {
      // 프로필 생성 실패 시 생성된 auth 유저도 롤백
      await adminSupabase.auth.admin.deleteUser(userId)
      throw new Error(profileErr.message)
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '서버 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
