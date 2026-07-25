/**
 * GET /api/member-alerts
 *
 * 로그인 회원 본인 노드 중 "조치 필요" 상태(정지 예정 / 정지됨)를 반환.
 * 대시보드 로그인 모달 + 벨에서 사용.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    const { data: userData, error } = await admin.auth.getUser(token)
    if (error || !userData.user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
    const uid = userData.user.id

    // 본인 소유(또는 본인) 노드
    const { data: nodes } = await admin
      .from('profiles')
      .select('id, node_id, name, status, pending_action, grace_until, pending_reason')
      .or(`owner_id.eq.${uid},id.eq.${uid}`)

    const alerts = (nodes ?? [])
      .filter(n => n.pending_action === 'suspend' || n.status === 'suspended')
      .map(n => ({
        nodeId: n.node_id,
        name: n.name,
        kind: n.status === 'suspended' ? 'suspended' : 'pending_suspend',
        graceUntil: n.grace_until,
        reason: n.pending_reason,
      }))

    return NextResponse.json({ alerts })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '조회 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
