import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/audit'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  return data.user?.app_metadata?.role === 'admin'
}

/**
 * PATCH /api/admin/member
 * body: { id, rank?, mt5_account_id?, trc20_address?, status?, status_reason? }
 */
export async function PATCH(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }

    const { id, rank, mt5_account_id, trc20_address, status, status_reason } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // 현재 상태 조회 (rank/status 변경 감지용)
    const { data: cur } = await admin.from('profiles').select('rank, status').eq('id', id).single()

    const updates: Record<string, unknown> = {}
    if (rank            !== undefined) updates.rank            = rank
    if (mt5_account_id  !== undefined) updates.mt5_account_id  = mt5_account_id  || null
    if (trc20_address   !== undefined) updates.trc20_address   = trc20_address   || null
    if (status          !== undefined) updates.status          = status

    if (!Object.keys(updates).length)
      return NextResponse.json({ error: '변경 항목이 없습니다.' }, { status: 400 })

    // rank 변경 → rank_history 기록
    if (rank !== undefined && cur && cur.rank !== rank) {
      await admin.from('rank_history').insert({
        profile_id: id,
        old_rank:   cur.rank,
        new_rank:   rank,
        changed_at: new Date().toISOString(),
      })
    }

    // status 변경 → status_history 기록
    if (status !== undefined && cur && cur.status !== status) {
      // 요청한 관리자 UID: verifyAdmin 에서 이미 확인한 토큰에서 추출
      const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
      const { data: adminUser } = await admin.auth.getUser(token)
      await admin.from('status_history').insert({
        profile_id:  id,
        old_status:  cur.status ?? 'active',
        new_status:  status,
        reason:      status_reason || null,
        changed_by:  adminUser.user?.id ?? null,
        changed_at:  new Date().toISOString(),
      })
    }

    const { error } = await admin.from('profiles').update(updates).eq('id', id)
    if (error) throw error

    // 감사 로그
    const auditTok = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
    const { data: actor } = await admin.auth.getUser(auditTok)
    await logAudit({
      actorId: actor.user?.id, actorEmail: actor.user?.email, action: 'member_update',
      targetType: 'node', targetId: id, detail: updates as Record<string, unknown>,
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? '서버 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
