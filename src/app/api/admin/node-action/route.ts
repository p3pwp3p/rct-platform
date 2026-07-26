/**
 * POST /api/admin/node-action
 *
 * 관리자가 노드에 직접 조치. body: { nodeId, action }
 *   action: 'reactivate' | 'suspend' | 'expel' | 'cancel_pending'
 *
 * - reactivate: 정지/제명 → active
 * - suspend:    active → suspended (수동 정지)
 * - expel:      → expelled (제명, 수동 복권 필요)
 * - cancel_pending: 정지 예정(pending) 해제
 *
 * 인증: 관리자 토큰. 감사로그 + 회원 알림 기록.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/audit'
import { createNotifications } from '@/lib/notify'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ACTIONS = ['reactivate', 'suspend', 'expel', 'cancel_pending'] as const
type Action = typeof ACTIONS[number]

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    const { data: u } = await admin.auth.getUser(token)
    if (u.user?.app_metadata?.role !== 'admin') return NextResponse.json({ error: '관리자 권한 필요' }, { status: 401 })

    const { nodeId, action } = await req.json()
    if (!nodeId || !ACTIONS.includes(action)) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })

    const { data: node } = await admin.from('profiles').select('id, node_id, name').eq('id', nodeId).single()
    if (!node) return NextResponse.json({ error: '노드를 찾을 수 없습니다.' }, { status: 404 })

    const patch: Record<string, string | null> = {}
    let notifTitle = ''
    let notifBody = ''
    switch (action as Action) {
      case 'reactivate':
        patch.status = 'active'; patch.pending_action = null; patch.grace_until = null; patch.pending_reason = null
        notifTitle = `${node.node_id} 노드가 재활성되었습니다`; notifBody = '관리자에 의해 다시 활성화되었습니다.'
        break
      case 'suspend':
        patch.status = 'suspended'; patch.pending_action = null; patch.grace_until = null; patch.pending_reason = null
        notifTitle = `${node.node_id} 노드가 정지되었습니다`; notifBody = '관리자에 의해 정지되었습니다.'
        break
      case 'expel':
        patch.status = 'expelled'; patch.pending_action = null; patch.grace_until = null; patch.pending_reason = null
        notifTitle = `${node.node_id} 노드가 제명되었습니다`; notifBody = '관리자에 의해 제명되었습니다.'
        break
      case 'cancel_pending':
        patch.pending_action = null; patch.grace_until = null; patch.pending_reason = null
        notifTitle = `${node.node_id} 노드 정지 예정 해제`; notifBody = '관리자에 의해 정지 예정이 취소되었습니다.'
        break
    }

    const { error } = await admin.from('profiles').update(patch).eq('id', nodeId)
    if (error) throw new Error(error.message)

    await logAudit({
      actorId: u.user?.id, actorEmail: u.user?.email, action: `node_${action}`,
      targetType: 'node', targetId: node.node_id, detail: { name: node.name },
    })
    await createNotifications([{ profileId: nodeId, type: 'system', title: notifTitle, body: notifBody }])

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '처리 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
